import { Collection } from "tinacms";

const PathwaySchema: Collection = {
    name: 'pathways',
    label: 'Health Pathways',
    path: 'content/pathways',
    format: 'json',
    fields: [
      {
        type: 'string',
        name: 'title',
        label: 'Page Title',
        isTitle: true,
        required: true,
      },

      {
        name: 'unstructured',
        label: 'Unstructured Content',
        type: 'rich-text',
        parser: { type: 'json' },
      },
    ],
  };
  
  export default PathwaySchema;