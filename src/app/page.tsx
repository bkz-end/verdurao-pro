import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function Home() {
  // Always redirect to login - middleware will handle auth redirects
  redirect('/login')
}
