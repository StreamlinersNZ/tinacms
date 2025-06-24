import client from '@/tina/__generated__/client'
import SlateJsonPost from './client-page'

export async function generateStaticParams() {
  const pages = await client.queries.slateJsonConnection()
  const paths = pages.data?.slateJsonConnection?.edges?.map((edge) => ({
    filename: edge?.node?._sys.breadcrumbs,
  }))

  return paths || []
}

export default async function SlateJsonPage({
  params,
}: {
  params: { filename: string[] }
}) {
  const data = await client.queries.slateJson({
    relativePath: `${params.filename}.json`,
  })

  return <SlateJsonPost {...data} />
}
