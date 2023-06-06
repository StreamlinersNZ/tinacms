import React, { Fragment, useEffect, useState } from 'react'
import {
  BiArrowBack,
  BiCopy,
  BiEdit,
  BiFile,
  BiFolder,
  BiPlus,
  BiTrash,
  BiRename,
  BiSearch,
  BiX,
} from 'react-icons/bi'
import { RiHome2Line } from 'react-icons/ri'
import {
  Link,
  NavigateFunction,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'
import { Menu, Transition } from '@headlessui/react'
import {
  BaseTextField,
  Button,
  CursorPaginator,
  Input,
  Modal,
  ModalActions,
  ModalBody,
  ModalHeader,
  OverflowMenu,
  PopupModal,
  ReactDateTimeWithStyles,
  Select,
  textFieldClasses,
  TinaCMS,
  Toggle,
} from '@tinacms/toolkit'
import type {
  CollectionResponse,
  DocumentSys,
  TemplateResponse,
} from '../types'
import GetCMS from '../components/GetCMS'
import GetCollection from '../components/GetCollection'
import { RouteMappingPlugin } from '../plugins/route-mapping'
import { PageBody, PageHeader, PageWrapper } from '../components/Page'
import { TinaAdminApi } from '../api'
import type { Collection } from '@tinacms/schema-tools'
import { CollectionFolder, useCollectionFolder } from './utils'

const LOCAL_STORAGE_KEY = 'tinacms.admin.collection.list.page'
const isSSR = typeof window === 'undefined'

const TemplateMenu = ({
  templates,
  folder,
  collectionName,
}: {
  collectionName: string
  templates: TemplateResponse[]
  folder: CollectionFolder
}) => {
  return (
    <Menu as="div" className="relative inline-block text-left">
      {() => (
        <div>
          <div>
            <Menu.Button className="icon-parent inline-flex items-center font-medium focus:outline-none focus:ring-2 focus:shadow-outline text-center rounded-full justify-center transition-all duration-150 ease-out  shadow text-white bg-blue-500 hover:bg-blue-600 focus:ring-blue-500 text-sm h-10 px-6">
              Create New <BiPlus className="w-5 h-full ml-1 opacity-70" />
            </Menu.Button>
          </div>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items className="origin-top-right absolute right-0 mt-2 z-menu w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none">
              <div className="py-1">
                {templates.map((template) => (
                  <Menu.Item key={`${template.label}-${template.name}`}>
                    {({ active }) => (
                      <Link
                        to={`/${
                          folder.fullyQualifiedName
                            ? [
                                'collections',
                                'new',
                                collectionName,
                                template.name,
                                '~',
                                folder.name,
                              ].join('/')
                            : [
                                'collections',
                                'new',
                                collectionName,
                                template.name,
                              ].join('/')
                        }`}
                        // to={`${template.name}/new`}
                        className={`w-full text-md px-4 py-2 tracking-wide flex items-center transition ease-out duration-100 ${
                          active
                            ? 'text-blue-600 opacity-100 bg-gray-50'
                            : 'opacity-80 text-gray-600'
                        }`}
                      >
                        {template.label}
                      </Link>
                    )}
                  </Menu.Item>
                ))}
              </div>
            </Menu.Items>
          </Transition>
        </div>
      )}
    </Menu>
  )
}

export const handleNavigate = (
  navigate: NavigateFunction,
  cms: TinaCMS,
  // FIXME: `Collection` is deceiving because it's just the value we get back from the API request
  collection: CollectionResponse,
  // The actual Collection definition
  collectionDefinition: Collection<true>,
  document: DocumentSys
) => {
  /**
   * Retrieve the RouteMapping Plugin
   */
  const plugins = cms.plugins.all<RouteMappingPlugin>('tina-admin')
  const routeMapping = plugins.find(({ name }) => name === 'route-mapping')
  const tinaPreview = cms.flags.get('tina-preview') || false

  /**
   * Determine if the document has a route mapped
   */
  let routeOverride = collectionDefinition.ui?.router
    ? collectionDefinition.ui?.router({
        document,
        collection: collectionDefinition,
      })
    : routeMapping
    ? routeMapping.mapper(collection, document)
    : undefined

  /**
   * Redirect the browser if 'yes', else navigate react-router.
   */
  if (routeOverride) {
    // remove leading /
    if (routeOverride.startsWith('/')) {
      routeOverride = routeOverride.slice(1)
    }
    tinaPreview
      ? navigate(`/~/${routeOverride}`)
      : (window.location.href = routeOverride)
    return null
  } else {
    const pathToDoc = document._sys.breadcrumbs
    navigate(
      `/${['collections', 'edit', collection.name, ...pathToDoc].join('/')}`,
      { replace: true }
    )
  }
}

const CollectionListPage = () => {
  const navigate = useNavigate()
  const { collectionName } = useParams()
  const [deleteModalOpen, setDeleteModalOpen] = React.useState(false)
  const [renameModalOpen, setRenameModalOpen] = React.useState(false)
  const [vars, setVars] = React.useState({
    collection: collectionName,
    relativePath: '',
    newRelativePath: '',
    filterField: '',
    startsWith: '',
    endsWith: '',
    before: '',
    after: '',
    booleanEquals: null,
  })
  const [endCursor, setEndCursor] = useState('')
  const [prevCursors, setPrevCursors] = useState([])
  const [sortKey, setSortKey] = useState(
    // set sort key to cached value if it exists
    isSSR
      ? ''
      : window.localStorage.getItem(`${LOCAL_STORAGE_KEY}.${collectionName}`) ||
          JSON.stringify({
            order: 'asc',
            name: '',
          })
  )
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const { order = 'asc', name: sortName } = JSON.parse(sortKey || '{}')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(order)
  const loc = useLocation()
  const folder = useCollectionFolder()
  useEffect(() => {
    // set sort key to cached value on route change
    setSortKey(
      window.localStorage.getItem(`${LOCAL_STORAGE_KEY}.${collectionName}`) ||
        JSON.stringify({
          order: 'asc',
          name: '',
        })
    )
    // reset state when the route is changed
    setEndCursor('')
    setPrevCursors([])
  }, [loc])

  useEffect(() => {
    // reset filter when the route is changed
    setVars((old) => ({
      ...old,
      collection: collectionName,
      relativePath: '',
      newRelativePath: '',
      filterField: '',
      startsWith: '',
      endsWith: '',
      before: '',
      after: '',
      booleanEquals: null,
    }))
  }, [collectionName])

  return (
    <GetCMS>
      {(cms: TinaCMS) => {
        return (
          <PageWrapper>
            <GetCollection
              cms={cms}
              collectionName={collectionName}
              includeDocuments
              startCursor={endCursor}
              sortKey={sortKey}
              folder={folder}
              filterArgs={
                // only pass filter args if the collection is the same as the current route
                // We need this hear because this runs before the useEffect above
                collectionName === vars.collection
                  ? vars
                  : {
                      collection: collectionName,
                      relativePath: '',
                      newRelativePath: '',
                      filterField: '',
                      startsWith: '',
                      endsWith: '',
                      before: '',
                      after: '',
                      booleanEquals: null,
                    }
              }
              search={search}
            >
              {(
                collection: CollectionResponse,
                _loading,
                reFetchCollection,
                collectionExtra: Collection<true>
              ) => {
                const totalCount = collection.documents.totalCount
                const documents = collection.documents.edges
                const admin: TinaAdminApi = cms.api.admin
                const pageInfo = collection.documents.pageInfo
                const fields = collectionExtra.fields?.filter((x) =>
                  // only allow sortable fields
                  ['string', 'number', 'datetime', 'boolean'].includes(x.type)
                )
                const sortField = fields?.find(
                  (field) => field.name === sortName
                )

                const searchEnabled =
                  !!cms.api.tina.schema?.config?.config?.search

                const collectionDefinition = cms.api.tina.schema.getCollection(
                  collection.name
                )

                const allowCreate =
                  collectionDefinition?.ui?.allowedActions?.create ?? true
                const allowDelete =
                  collectionDefinition?.ui?.allowedActions?.delete ?? true

                const folderView = folder.fullyQualifiedName !== ''

                return (
                  <>
                    {deleteModalOpen && (
                      <DeleteModal
                        filename={vars.relativePath}
                        deleteFunc={async () => {
                          try {
                            await admin.deleteDocument(vars)
                            cms.alerts.info('Document was successfully deleted')
                            reFetchCollection()
                          } catch (error) {
                            cms.alerts.warn(
                              'Document was not deleted, ask a developer for help or check the console for an error message'
                            )
                            console.error(error)
                            throw error
                          }
                        }}
                        close={() => setDeleteModalOpen(false)}
                      />
                    )}

                    {renameModalOpen && (
                      <RenameModal
                        filename={vars.relativePath}
                        newRelativePath={vars.newRelativePath}
                        setNewRelativePath={(newRelativePath) => {
                          setVars((vars) => {
                            return { ...vars, newRelativePath }
                          })
                        }}
                        renameFunc={async () => {
                          // add the file extension
                          const newRelativePath = `${vars.newRelativePath}.${collection.format}`
                          try {
                            await admin.renameDocument({
                              collection: vars.collection,
                              relativePath: vars.relativePath,
                              newRelativePath,
                            })
                            cms.alerts.info('Document was successfully renamed')
                            reFetchCollection()
                          } catch (error) {
                            cms.alerts.warn(
                              'Document was not renamed, ask a developer for help or check the console for an error message'
                            )
                            console.error(error)
                            throw error
                          }
                        }}
                        close={() => setRenameModalOpen(false)}
                      />
                    )}

                    <PageHeader isLocalMode={cms?.api?.tina?.isLocalMode}>
                      <div className="w-full grid grid-flow-col items-end gap-4">
                        <div className="flex flex-col gap-4">
                          <h3 className="font-sans text-2xl text-gray-700">
                            {collection.label
                              ? collection.label
                              : collection.name}
                          </h3>

                          <div className="flex gap-4 items-start flex-wrap">
                            {fields?.length > 0 && (
                              <>
                                {!search && (
                                  <div className="flex flex-col gap-2 items-start">
                                    <label
                                      htmlFor="sort"
                                      className="block font-sans text-xs font-semibold text-gray-500 whitespace-normal"
                                    >
                                      Sort by
                                    </label>
                                    <Select
                                      name="sort"
                                      options={[
                                        {
                                          label: 'Default',
                                          value: JSON.stringify({
                                            order: 'asc',
                                            name: '',
                                          }),
                                        },
                                        ...fields
                                          .map((x) => [
                                            {
                                              label:
                                                (x.label || x.name) +
                                                (x.type === 'datetime'
                                                  ? ' (Oldest First)'
                                                  : ' (Ascending)'),
                                              value: JSON.stringify({
                                                name: x.name,
                                                order: 'asc',
                                              }),
                                            },
                                            {
                                              label:
                                                (x.label || x.name) +
                                                (x.type === 'datetime'
                                                  ? ' (Newest First)'
                                                  : ' (Descending)'),
                                              value: JSON.stringify({
                                                name: x.name,
                                                order: 'desc',
                                              }),
                                            },
                                          ])
                                          .flat(),
                                      ]}
                                      input={{
                                        id: 'sort',
                                        name: 'sort',
                                        value: sortKey,
                                        onChange: (e) => {
                                          const val = JSON.parse(e.target.value)
                                          setEndCursor('')
                                          setPrevCursors([])
                                          window?.localStorage.setItem(
                                            `${LOCAL_STORAGE_KEY}.${collectionName}`,
                                            e.target.value
                                          )
                                          setSortKey(e.target.value)
                                          setSortOrder(val.order)
                                        },
                                      }}
                                    />
                                  </div>
                                )}
                                {searchEnabled && (
                                  <SearchInput
                                    loading={_loading}
                                    search={search}
                                    setSearch={setSearch}
                                    searchInput={searchInput}
                                    setSearchInput={setSearchInput}
                                  />
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex self-end	justify-self-end">
                          {!collection.templates && allowCreate && (
                            <Link
                              to={`/${
                                folder.fullyQualifiedName
                                  ? [
                                      'collections',
                                      'new',
                                      collectionName,
                                      '~',
                                      folder.name,
                                    ].join('/')
                                  : ['collections', 'new', collectionName].join(
                                      '/'
                                    )
                              }`}
                              className="icon-parent inline-flex items-center font-medium focus:outline-none focus:ring-2 focus:shadow-outline text-center rounded-full justify-center transition-all duration-150 ease-out whitespace-nowrap shadow text-white bg-blue-500 hover:bg-blue-600 focus:ring-blue-500 text-sm h-10 px-6"
                            >
                              Create New{' '}
                              <BiPlus className="w-5 h-full ml-1 opacity-70" />
                            </Link>
                          )}
                          {collection.templates && allowCreate && (
                            <TemplateMenu
                              collectionName={collectionName}
                              templates={collection.templates}
                              folder={folder}
                            />
                          )}
                        </div>
                      </div>
                    </PageHeader>
                    <PageBody>
                      <div className="w-full mx-auto max-w-screen-xl">
                        {sortField && !sortField.required && (
                          <p className="mb-4 text-gray-500">
                            <em>
                              Sorting on a non-required field. Some documents
                              may be excluded (if they don't have a value for{' '}
                              {sortName})
                            </em>
                          </p>
                        )}
                        {documents.length > 0 ? (
                          <table className="table-auto shadow bg-white border-b border-gray-200 w-full max-w-full rounded-lg">
                            <tbody className="divide-y divide-gray-150">
                              {folder.name && !search && (
                                <tr>
                                  <td colSpan={5}>
                                    <Breadcrumb
                                      folder={folder}
                                      navigate={navigate}
                                      collectionName={collectionName}
                                    />
                                  </td>
                                </tr>
                              )}
                              {documents.map((document) => {
                                if (document.node.__typename === 'Folder') {
                                  return (
                                    <tr key={`folder-${document.node.path}`}>
                                      <td className="pl-5 pr-3 py-3 truncate max-w-0">
                                        <a
                                          className="text-blue-600 hover:text-blue-400 flex items-center gap-3 cursor-pointer truncate"
                                          onClick={() => {
                                            navigate(
                                              `/${[
                                                'collections',
                                                collectionName,
                                                document.node.path,
                                              ].join('/')}`,
                                              { replace: true }
                                            )
                                          }}
                                        >
                                          <BiFolder className="inline-block h-6 w-auto flex-shrink-0 opacity-70" />
                                          <span className="truncate block">
                                            <span className="block text-xs text-gray-400 mb-1 uppercase">
                                              Name
                                            </span>
                                            <span className="h-5 leading-5 block truncate">
                                              <span>{document.node.name}</span>
                                            </span>
                                          </span>
                                        </a>
                                      </td>
                                      <td
                                        className="px-3 py-3 truncate max-w-0"
                                        colSpan={4}
                                      >
                                        <span className="block text-xs text-gray-400 mb-1 uppercase">
                                          Path
                                        </span>
                                        <span className="leading-5 block text-sm font-medium text-gray-900 truncate">
                                          {document.node.path
                                            .substring(2)
                                            .split('/')
                                            .map((node) => {
                                              return (
                                                <span key={node}>
                                                  <span className="text-gray-300 pr-0.5">
                                                    /
                                                  </span>
                                                  <span className="pr-0.5">
                                                    {node}
                                                  </span>
                                                </span>
                                              )
                                            })}
                                        </span>
                                      </td>
                                    </tr>
                                  )
                                }

                                const hasTitle = Boolean(
                                  document.node._sys.title
                                )
                                const subfolders =
                                  document.node._sys.breadcrumbs
                                    .slice(0, -1)
                                    .join('/')

                                return (
                                  <tr
                                    key={`document-${document.node._sys.relativePath}`}
                                    className=""
                                  >
                                    <td
                                      className="pl-5 pr-3 py-3 truncate max-w-0"
                                      colSpan={hasTitle ? 1 : 2}
                                    >
                                      <a
                                        className="text-blue-600 hover:text-blue-400 flex items-center gap-3 cursor-pointer truncate"
                                        onClick={() => {
                                          handleNavigate(
                                            navigate,
                                            cms,
                                            collection,
                                            collectionDefinition,
                                            document.node
                                          )
                                        }}
                                      >
                                        <BiFile className="inline-block h-6 w-auto flex-shrink-0 opacity-70" />
                                        <span className="truncate block">
                                          <span className="block text-xs text-gray-400 mb-1 uppercase">
                                            {hasTitle ? 'Title' : 'Filename'}
                                          </span>
                                          <span className="h-5 leading-5 block truncate">
                                            {!folderView &&
                                              !hasTitle &&
                                              subfolders && (
                                                <span className="text-xs text-gray-400">
                                                  {`${subfolders}/`}
                                                </span>
                                              )}
                                            <span>
                                              {hasTitle
                                                ? document.node._sys?.title
                                                : document.node._sys.filename}
                                            </span>
                                          </span>
                                        </span>
                                      </a>
                                    </td>
                                    {hasTitle && (
                                      <td className="px-3 py-3 truncate max-w-0">
                                        <span className="block text-xs text-gray-400 mb-1 uppercase">
                                          Filename
                                        </span>
                                        <span className="h-5 leading-5 block text-sm font-medium text-gray-900 truncate">
                                          {!folderView && subfolders && (
                                            <span className="text-xs text-gray-400">
                                              {`${subfolders}/`}
                                            </span>
                                          )}
                                          <span>
                                            {document.node._sys.filename}
                                          </span>
                                        </span>
                                      </td>
                                    )}
                                    <td className="px-3 py-3 truncate w-[15%]">
                                      <span className="block text-xs text-gray-400 mb-1 uppercase">
                                        Extension
                                      </span>
                                      <span className="h-5 leading-5 block text-sm font-medium text-gray-900">
                                        {document.node._sys.extension}
                                      </span>
                                    </td>
                                    <td className="px-3 py-3 truncate w-[15%]">
                                      <span className="block text-xs text-gray-400 mb-1 uppercase">
                                        Template
                                      </span>
                                      <span className="h-5 leading-5 block text-sm font-medium text-gray-900">
                                        {document.node._sys.template}
                                      </span>
                                    </td>
                                    <td className="w-0">
                                      <OverflowMenu
                                        toolbarItems={[
                                          {
                                            name: 'edit',
                                            label: 'Edit in Admin',
                                            Icon: <BiEdit size="1.3rem" />,
                                            onMouseDown: () => {
                                              const pathToDoc =
                                                document.node._sys.breadcrumbs
                                              if (folder.fullyQualifiedName) {
                                                pathToDoc.unshift('~')
                                              }
                                              navigate(
                                                `/${[
                                                  'collections',
                                                  'edit',
                                                  collectionName,
                                                  ...pathToDoc,
                                                ].join('/')}`,
                                                { replace: true }
                                              )
                                            },
                                          },
                                          allowCreate && {
                                            name: 'duplicate',
                                            label: 'Duplicate',
                                            Icon: <BiCopy size="1.3rem" />,
                                            onMouseDown: () => {
                                              const pathToDoc =
                                                document.node._sys.breadcrumbs
                                              if (folder.fullyQualifiedName) {
                                                pathToDoc.unshift('~')
                                              }
                                              navigate(
                                                `/${[
                                                  'collections',
                                                  'duplicate',
                                                  collectionName,
                                                  ...pathToDoc,
                                                ].join('/')}`,
                                                { replace: true }
                                              )
                                            },
                                          },
                                          allowDelete && {
                                            name: 'delete',
                                            label: 'Delete',
                                            Icon: (
                                              <BiTrash
                                                size="1.3rem"
                                                className="text-red-500"
                                              />
                                            ),
                                            onMouseDown: () => {
                                              setVars((old) => ({
                                                ...old,
                                                collection: collectionName,
                                                relativePath:
                                                  document.node._sys.breadcrumbs.join(
                                                    '/'
                                                  ) +
                                                  document.node._sys.extension,
                                                newRelativePath: '',
                                              }))
                                              setDeleteModalOpen(true)
                                            },
                                          },
                                          allowDelete && {
                                            name: 'rename',
                                            label: 'Rename',
                                            Icon: (
                                              <BiRename
                                                size="1.3rem"
                                                className="text-red-500"
                                              />
                                            ),
                                            onMouseDown: () => {
                                              setVars((old) => ({
                                                ...old,
                                                collection: collectionName,
                                                relativePath:
                                                  document.node._sys.breadcrumbs.join(
                                                    '/'
                                                  ) +
                                                  document.node._sys.extension,
                                                newRelativePath: '',
                                              }))
                                              setRenameModalOpen(true)
                                            },
                                          },
                                        ].filter(Boolean)}
                                      />
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        ) : (
                          <NoDocumentsPlaceholder />
                        )}
                        <div className="pt-4">
                          <CursorPaginator
                            variant="white"
                            hasNext={
                              sortOrder === 'asc'
                                ? pageInfo?.hasNextPage
                                : pageInfo.hasPreviousPage
                            }
                            navigateNext={() => {
                              const newState = [...prevCursors, endCursor]
                              setPrevCursors(newState)
                              setEndCursor(pageInfo?.endCursor)
                            }}
                            hasPrev={prevCursors.length > 0}
                            navigatePrev={() => {
                              const prev = prevCursors[prevCursors.length - 1]
                              if (typeof prev === 'string') {
                                const newState = prevCursors.slice(0, -1)
                                setPrevCursors(newState)
                                setEndCursor(prev)
                              }
                            }}
                          />
                        </div>
                      </div>
                    </PageBody>
                  </>
                )
              }}
            </GetCollection>
          </PageWrapper>
        )
      }}
    </GetCMS>
  )
}

const SearchInput = ({
  loading,
  search,
  setSearch,
  searchInput,
  setSearchInput,
}) => {
  const [searchLoaded, setSearchLoaded] = useState(false)
  useEffect(() => {
    if (loading) {
      setSearchLoaded(false)
    } else {
      setSearchLoaded(true)
    }
  }, [loading])

  return (
    <form className="flex flex-1 flex-col gap-2 items-start w-full">
      <label
        htmlFor="search"
        className="block font-sans text-xs font-semibold text-gray-500 whitespace-normal"
      >
        Search
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <Input
            type="text"
            name="search"
            placeholder="Search"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value)
            }}
          />
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => {
              setSearch(searchInput)
              setSearchLoaded(false)
            }}
            variant="primary"
            type="submit"
          >
            Search <BiSearch className="w-5 h-full ml-1.5 opacity-70" />
          </Button>
          {search && searchLoaded && (
            <Button
              onClick={() => {
                setSearch('')
                setSearchInput('')
              }}
              variant="white"
            >
              Clear <BiX className="w-5 h-full ml-1 opacity-70" />
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}

const Breadcrumb = ({ folder, navigate, collectionName }) => {
  const folderArray = folder.name.split('/')

  return (
    <div className="w-full bg-gray-50/30 flex items-stretch">
      <button
        onClick={() => {
          const folders = folder.fullyQualifiedName.split('/')
          navigate(
            `/${[
              'collections',
              collectionName,
              ...folders.slice(0, folders.length - 1),
            ].join('/')}`,
            { replace: true }
          )
        }}
        className="px-3 py-2 bg-white hover:bg-gray-50/50 transition ease-out duration-100 border-r border-gray-100 text-blue-500 hover:text-blue-600"
      >
        <BiArrowBack className="w-6 h-full opacity-70" />
      </button>
      <span className="px-3 py-2 text-gray-600 flex flex-wrap items-center justify-start gap-1">
        <button
          onClick={() => {
            navigate(`/collections/${collectionName}/~`, {
              replace: true,
            })
          }}
          className="shrink-0 bg-transparent p-0 border-0 text-blue-400 hover:text-blue-500 transition-all ease-out duration-100 opacity-70 hover:opacity-100"
        >
          <RiHome2Line className="w-5 h-auto" />
        </button>
        {folderArray.map((node, index) => {
          return (
            <>
              <span className="text-gray-200 shrink-0">/</span>
              {index < folderArray.length - 1 ? (
                <button
                  className="bg-transparent whitespace-nowrap truncate p-0 border-0 text-blue-500 hover:text-blue-600 transition-all ease-out duration-100 underline underline-offset-2 decoration-1	decoration-blue-200 hover:decoration-blue-400"
                  onClick={() => {
                    const folders = folder.fullyQualifiedName.split('/')
                    navigate(
                      `/${[
                        'collections',
                        collectionName,
                        ...folders.slice(
                          0,
                          folders.length - (folders.length - (index + 2))
                        ),
                      ].join('/')}`,
                      { replace: true }
                    )
                  }}
                >
                  {node}
                </button>
              ) : (
                <span className="whitespace-nowrap truncate">{node}</span>
              )}
            </>
          )
        })}
      </span>
    </div>
  )
}

interface ResetModalProps {
  close(): void
  deleteFunc(): void
  filename: string
}

const NoDocumentsPlaceholder = () => {
  return (
    <div className="text-center px-5 py-3 flex flex-col items-center justify-center shadow border border-gray-100 bg-gray-50 border-b border-gray-200 w-full max-w-full rounded-lg">
      <p className="text-base italic font-medium text-gray-300">
        No documents found.
      </p>
    </div>
  )
}

const DeleteModal = ({ close, deleteFunc, filename }: ResetModalProps) => {
  return (
    <Modal>
      <PopupModal>
        <ModalHeader close={close}>Delete {filename}</ModalHeader>
        <ModalBody padded={true}>
          <p>{`Are you sure you want to delete ${filename}?`}</p>
        </ModalBody>
        <ModalActions>
          <Button style={{ flexGrow: 2 }} onClick={close}>
            Cancel
          </Button>
          <Button
            style={{ flexGrow: 3 }}
            variant="danger"
            onClick={async () => {
              await deleteFunc()
              close()
            }}
          >
            Delete
          </Button>
        </ModalActions>
      </PopupModal>
    </Modal>
  )
}

interface RenameModalProps {
  close(): void
  renameFunc(): void
  filename: string
  setNewRelativePath(newRelativePath: string): void
  newRelativePath: string
}

const RenameModal = ({
  close,
  renameFunc,
  filename,
  newRelativePath,
  setNewRelativePath,
}: RenameModalProps) => {
  return (
    <Modal>
      <PopupModal>
        <ModalHeader close={close}>Rename {filename}</ModalHeader>
        <ModalBody padded={true}>
          <>
            <p className="mb-4">
              Are you sure you want to rename <strong>{filename}</strong>?
              TinaCMS uses the filename as the ID; renaming this file could
              result in unresolved references.
            </p>
            <BaseTextField
              placeholder="Enter a new name for the document's file"
              value={newRelativePath}
              onChange={(event) => setNewRelativePath(event.target.value)}
            ></BaseTextField>
          </>
        </ModalBody>
        <ModalActions>
          <Button style={{ flexGrow: 2 }} onClick={close}>
            Cancel
          </Button>
          <Button
            style={{ flexGrow: 3 }}
            variant="primary"
            onClick={async () => {
              await renameFunc()
              close()
            }}
          >
            Rename
          </Button>
        </ModalActions>
      </PopupModal>
    </Modal>
  )
}
export default CollectionListPage
