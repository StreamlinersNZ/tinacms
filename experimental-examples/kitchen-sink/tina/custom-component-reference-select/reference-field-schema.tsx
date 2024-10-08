import React from 'react'
import AuthorCollectionCustomReference from '../../component/custom-reference-select-author'
import PostCollectionCustomReference from '../../component/custom-reference-select-post'
import { type CollectionProps, COLLECTIONS, type InternalSys } from './model'

const referenceField = {
  label: 'Author',
  name: 'author',
  type: 'reference',
  ui: {
    experimental___filter(list, searchQuery) {
      if (!searchQuery) {
        return [list[0]]
      }

      const filteredListZeroEdges = list[0].edges?.filter((item) => {
        console.log('item', item)

        if (
          item.node._values.name
            .toLowerCase()
            .includes(searchQuery?.toLowerCase())
        ) {
          return item
        }
      })

      return [
        {
          collection: list[0].collection,
          edges: filteredListZeroEdges,
        },
      ]
    },
    optionComponent: (values: CollectionProps, s: InternalSys) => {
      switch (values._collection) {
        case COLLECTIONS.AUTHOR:
          return (
            <AuthorCollectionCustomReference
              name={values.name}
              description={values.description}
            />
          )

        case COLLECTIONS.POST:
          return <PostCollectionCustomReference title={values.title} />

        default:
          return s.path
      }
    },
  },
  collections: ['author', 'post'],
}

export default referenceField
