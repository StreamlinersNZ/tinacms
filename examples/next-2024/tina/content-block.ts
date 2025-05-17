import type { Collection } from 'tinacms';
import type { RichTextTemplate } from '@tinacms/schema-tools';

/**
 * Represents a "content item" that is a single piece of content that can be used in a pathway or other content items.
 */
const ContentBlockSchema: Collection = {
  name: 'contentBlock',
  label: 'Content Block',
  path: 'content/content-blocks',
  format: 'json',
  fields: [
    {
      name: 'content',
      label: 'Content Block',
      type: 'rich-text',
      parser: { type: 'json' },
    },
  ],
};

export const contentBlockTemplate: RichTextTemplate = {
  name: 'contentBlock',
  label: 'Content Block',
  inline: true,

  fields: [
    {
      name: 'title',
      label: 'Editor Display Text',
      type: 'string',
      isTitle: true,
      required: true,
    },
    {
      name: 'displayStyle',
      label: 'Display Style',
      type: 'string',
      options: ['Text Block', 'Dropbox', 'Inline'],
      ui: {
        format(value) {
          switch (value) {
            case 'text_block':
              return 'Text Block';
            case 'dropbox':
              return 'Dropbox';
            case 'inline':
              return 'Inline';
            default:
              return 'Dropbox';
          }
        },
        parse(value) {
          switch (value) {
            case 'Text Block':
              return 'text_block';
            case 'Dropbox':
              return 'dropbox';
            case 'Inline':
              return 'inline';
            default:
              return 'dropbox';
          }
        },
      },
    },
    {
      name: 'block',
      label: 'Content Block',
      type: 'reference',
      collections: ['contentBlock'],
      required: true,
    },
  ],
};
export default ContentBlockSchema;
