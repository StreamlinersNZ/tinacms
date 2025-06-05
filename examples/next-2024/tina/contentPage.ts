import type { Collection } from "tinacms";
import type { RichTextField, RichTextTemplate, TinaField } from '@tinacms/schema-tools';

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

const richTextConfiguration: RichTextField = {
  name: 'override',
  label: 'override',
  type: 'rich-text',
  parser: { type: 'json' },
  templates: [contentBlockTemplate],
  toolbarOverride: [
    'embed',
    'bold',
    'italic',
    'ol',
    'ul',
    'raw',
    'table',
  ] as const,
};

export const contentBlock: Collection = {
  name: 'contentBlock',
  label: 'Content Block',
  path: 'content/content-blocks',
  format: 'json',

  fields: [
    {
      name: 'title',
      label: 'Title',
      type: 'string',
      isTitle: true,
      required: true,
    },
    {
      ...richTextConfiguration,
      name: 'content',
      label: 'Content Block',
    },
  ],
};


const TopSection: TinaField = {
  label: 'Top',
  name: 'top',
  type: 'object',
  fields: [
    {
      ...richTextConfiguration,
      name: 'content',
      label: 'Content',
    },
  ],
};

const NotesSection: TinaField = {
  label: 'Notes',
  name: 'notes',
  type: 'object',
  fields: [
    {
      name: 'content',
      label: 'Notes',
      type: 'rich-text',
      parser: { type: 'json' },
      toolbarOverride: ['bold', 'italic', 'ol', 'ul', 'raw', 'table'] as const,
    },
  ],
};

const RequestSection: TinaField = {
  label: 'Request',
  name: 'request',
  type: 'object',
  fields: [
    {
      ...richTextConfiguration,
      name: 'content',
      label: 'Content',
    },
  ],
};

const BackgroundSection: TinaField = {
  label: 'Background',
  name: 'background',
  type: 'object',
  fields: [
    {
      ...richTextConfiguration,
      name: 'content',
      label: 'Content',
    },
  ],
};

const AssessmentSection: TinaField = {
  label: 'Assessment',
  name: 'assessment',
  type: 'object',
  fields: [
    {
      ...richTextConfiguration,
      name: 'content',
      label: 'Content',
    },
  ],
};

const ManagementSection: TinaField = {
  label: 'Management',
  name: 'management',
  type: 'object',
  fields: [
    {
      ...richTextConfiguration,
      name: 'content',
      label: 'Content',
    },
  ],
};

const InformationSection: TinaField = {
  label: 'Information',
  name: 'information',
  type: 'object',
  fields: [
    {
      ...richTextConfiguration,
      name: 'content',
      label: 'Content',
    },
  ],
};

const ContentPageSchema: Collection = {
  label: 'Content Pages',
  name: 'pages',
  path: 'content/pages',
  format: 'json',
  fields: [
    {
      type: 'string',
      name: 'title',
      label: 'Page Title',
      isTitle: true,
      required: true,
    },
    TopSection,
    NotesSection,
    BackgroundSection,
    AssessmentSection,
    ManagementSection,
    RequestSection,
    InformationSection,
    {
      ...richTextConfiguration,
      name: 'unstructured',
      label: 'Unstructured Content',
    },
  ],
};

export default ContentPageSchema;
