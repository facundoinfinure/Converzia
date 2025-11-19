import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const { project_id } = await request.json()
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    // 1. Get Project & API Key
    const { data: project } = await supabase
        .from('projects')
        .select('tokko_api_key, tokko_id')
        .eq('id', project_id)
        .single()

    if (!project || !project.tokko_api_key) {
        return NextResponse.json({ error: 'Project not found or missing API Key' }, { status: 404 })
    }

    // 2. Fetch from Tokko API
    // Note: This is a mock URL. Replace with actual Tokko API endpoint.
    // const tokkoUrl = `https://www.tokkobroker.com/api/v1/development/${project.tokko_id}/?key=${project.tokko_api_key}`

    // MOCK RESPONSE for demonstration
    const tokkoData = {
        units_available: 12,
        min_price: 150000,
        max_price: 450000,
        amenities: ['Pool', 'Gym', 'Sum'],
        images: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg']
    }

    // 3. Update Supabase
    const { error } = await supabase
        .from('projects')
        .update({
            tokko_data: tokkoData,
            amenities: tokkoData.amenities,
            images: tokkoData.images
        })
        .eq('id', project_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, data: tokkoData })
}
