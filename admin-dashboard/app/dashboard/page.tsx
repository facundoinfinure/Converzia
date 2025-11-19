'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Users, Building, DollarSign, MessageSquare } from 'lucide-react'

const data = [
    { name: 'Jan', leads: 40, sales: 24 },
    { name: 'Feb', leads: 30, sales: 13 },
    { name: 'Mar', leads: 20, sales: 98 },
    { name: 'Apr', leads: 27, sales: 39 },
    { name: 'May', leads: 18, sales: 48 },
    { name: 'Jun', leads: 23, sales: 38 },
    { name: 'Jul', leads: 34, sales: 43 },
]

export default function Dashboard() {
    const [user, setUser] = useState<any>(null)
    const supabase = createClientComponentClient()

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)
        }
        getUser()
    }, [supabase])

    return (
        <div className="min-h-screen bg-gray-100">
            <nav className="bg-white shadow-sm">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 justify-between">
                        <div className="flex">
                            <div className="flex flex-shrink-0 items-center">
                                <span className="text-xl font-bold text-indigo-600">Real Estate Admin</span>
                            </div>
                        </div>
                        <div className="flex items-center">
                            <span className="text-sm text-gray-500 mr-4">{user?.email}</span>
                            <button onClick={() => supabase.auth.signOut()} className="text-sm font-medium text-gray-500 hover:text-gray-700">
                                Sign out
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="py-10">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <h1 className="text-3xl font-bold leading-tight text-gray-900">Dashboard</h1>

                    {/* KPI Cards */}
                    <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="overflow-hidden rounded-lg bg-white shadow">
                            <div className="p-5">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0">
                                        <Users className="h-6 w-6 text-gray-400" aria-hidden="true" />
                                    </div>
                                    <div className="ml-5 w-0 flex-1">
                                        <dl>
                                            <dt className="truncate text-sm font-medium text-gray-500">Total Leads</dt>
                                            <dd>
                                                <div className="text-lg font-medium text-gray-900">1,234</div>
                                            </dd>
                                        </dl>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-lg bg-white shadow">
                            <div className="p-5">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0">
                                        <Building className="h-6 w-6 text-gray-400" aria-hidden="true" />
                                    </div>
                                    <div className="ml-5 w-0 flex-1">
                                        <dl>
                                            <dt className="truncate text-sm font-medium text-gray-500">Active Projects</dt>
                                            <dd>
                                                <div className="text-lg font-medium text-gray-900">12</div>
                                            </dd>
                                        </dl>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-lg bg-white shadow">
                            <div className="p-5">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0">
                                        <MessageSquare className="h-6 w-6 text-gray-400" aria-hidden="true" />
                                    </div>
                                    <div className="ml-5 w-0 flex-1">
                                        <dl>
                                            <dt className="truncate text-sm font-medium text-gray-500">Conversations</dt>
                                            <dd>
                                                <div className="text-lg font-medium text-gray-900">5,432</div>
                                            </dd>
                                        </dl>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-lg bg-white shadow">
                            <div className="p-5">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0">
                                        <DollarSign className="h-6 w-6 text-gray-400" aria-hidden="true" />
                                    </div>
                                    <div className="ml-5 w-0 flex-1">
                                        <dl>
                                            <dt className="truncate text-sm font-medium text-gray-500">Revenue (Est)</dt>
                                            <dd>
                                                <div className="text-lg font-medium text-gray-900">$12,345</div>
                                            </dd>
                                        </dl>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Charts */}
                    <div className="mt-8">
                        <div className="overflow-hidden rounded-lg bg-white shadow">
                            <div className="p-6">
                                <h3 className="text-lg font-medium leading-6 text-gray-900">Lead Acquisition</h3>
                                <div className="mt-5 h-80 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={data}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <Tooltip />
                                            <Legend />
                                            <Bar dataKey="leads" fill="#4F46E5" />
                                            <Bar dataKey="sales" fill="#10B981" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    )
}
