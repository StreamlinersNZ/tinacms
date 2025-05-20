import { Collection } from 'tinacms'

const ContentBlockSchema: Collection = {
  name: 'contentBlock',
  label: 'Content Block',
  path: 'content/content-blocks',
  format: 'json',
  fields: [
    {
      name: 'content',
      label: 'Content',
      type: 'rich-text',
      parser: { type: 'json' },
    },
  ],
}

export default ContentBlockSchema
