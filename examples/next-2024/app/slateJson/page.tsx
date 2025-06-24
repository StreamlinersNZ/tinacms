import client from '@/tina/__generated__/client'
import Link from 'next/link'

export default async function Page() {
  const { data } = await client.queries.slateJsonConnection()

  return (
    <>
      <h1>Posts</h1>
      <div>
        {data.slateJsonConnection.edges?.map((post) => (
          <div key={post?.node?.id}>
            <Link href={`/slateJson/${post?.node?._sys.filename}`}>
              {post?.node?._sys.filename}
            </Link>
          </div>
        ))}
      </div>
    </>
  )
}
