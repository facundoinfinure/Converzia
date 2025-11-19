import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
})

export async function POST(request: Request) {
    const { quantity } = await request.json()
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore as any })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get Company ID for User
    const { data: companyUser } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single()

    if (!companyUser) return NextResponse.json({ error: 'No Company Found' }, { status: 400 })

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
            {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'Real Estate Leads Credit',
                    },
                    unit_amount: 1000, // $10.00 per lead
                },
                quantity: quantity,
            },
        ],
        mode: 'payment',
        success_url: `${request.headers.get('origin')}/dashboard?success=true`,
        cancel_url: `${request.headers.get('origin')}/dashboard?canceled=true`,
        metadata: {
            company_id: companyUser.company_id,
            credits: quantity,
        },
    })

    return NextResponse.json({ url: session.url })
}
