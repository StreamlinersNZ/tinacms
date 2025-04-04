import { DOMParser } from '@xmldom/xmldom'
import { RichTextParseError } from '../parse/remarkToPlate'

export interface SlateNode {
  type: string
  children?: SlateNode[]
  text?: string
  bold?: boolean
  italic?: boolean
  id?: string | number
  name?: string
  props?: {
    [key: string]: any
  }
  url?: string
  alt?: string
  caption?: string
}

// These attributes are either to be ignored or are manually added elsewehere
const ignoreThisAttributes = ['type', 'name', 'id']
function propsToAttributes(node?: { [key: string]: any }) {
  if (!node) return ''

  let attributes = ''

  for (const key in node) {
    if (node.hasOwnProperty(key) && !ignoreThisAttributes.includes(key)) {
      const value = node[key]
      if (typeof value !== 'object') {
        attributes += ` ${key}="${value}"`
      }
    }
  }

  return attributes
}

function convertSlateToXml(node: SlateNode): string {
  let xml = ''

  switch (node.type) {
    case 'mdxJsxTextElement':
    case 'mdxJsxFlowElement':
      const attributes = propsToAttributes(node.props)
      xml = `<${node.name} type="${node.type}"${attributes}`
      // xml = `<${node.name} id="${node.id}" type="${node.type}"${attributes}`
      // if we find 'content' we process it's children and skip the top level "root" node
      return node.props?.content
        ? `${xml}>${convertChildrenToXml(node.props.content.children)}</${
            node.name
          }>`
        : `${xml} />`
    case 'text':
    // Slate seems to be inconsistent with adding "type": "text" to text elements
    // so if there is no "type" it is a "text"
    case undefined:
      let text = node.text || ''
      if (node.bold) text = `<bold>${text}</bold>`
      if (node.italic) text = `<italic>${text}</italic>`
      return text
    default:
      xml = `<${node.type}${propsToAttributes(node)}`
      if (node.children) {
        // xml += '>'
        const children = convertChildrenToXml(node.children)
        return children ? `${xml}>${children}</${node.type}>` : `${xml} />`
      }
      return `${xml} />`
  }
}

function convertChildrenToXml(children?: SlateNode[]) {
  if (!children || children.length === 0) return ''

  let xml = ''

  for (const child of children) {
    xml += convertSlateToXml(child)
  }

  return xml
}

function formatXML(xml: string, tab = '  ', nl = '\n') {
  let formatted = '',
    indent = ''
  const nodes = xml.slice(1, -1).split(/>\s*</)
  if (nodes.length === 0 || !nodes[0]) return ''

  if (nodes[0][0] == '?') formatted += '<' + nodes.shift() + '>' + nl
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (!node) continue
    if (node[0]! == '/') indent = indent.slice(tab.length) // decrease indent
    formatted += indent + '<' + node + '>' + nl
    if (
      node[0] != '/' &&
      node[node.length - 1] != '/' &&
      node.indexOf('</') == -1
    )
      indent += tab // increase indent
  }
  return formatted
}

export function stringifyToXML(slateDoc: SlateNode): string {
  if (slateDoc.type !== 'root') {
    throw new Error(
      'Invalid Slate document: Root node should be of type "root".'
    )
  }

  const xml = convertChildrenToXml(slateDoc.children)
  // Make sure there's no leading or trailing empty paragraph. Slate throws errors in this case
  const sanitisedXml = xml.replace(/^<p\s*\/>/, '').replace(/<p\s*\/>$/, '')
  return formatXML(`<data>${sanitisedXml}</data>`)
}

// Safely check if a node has an attribute
const safeGetAttribute = (node: any, name: string): string | null => {
  try {
    if (node && typeof node.getAttribute === 'function') {
      return node.getAttribute(name)
    }
  } catch (e) {
    // Ignore error, return null
  }
  return null
}

// Safely check if a node has an attribute
const safeHasAttribute = (node: any, name: string): boolean => {
  try {
    if (node && typeof node.hasAttribute === 'function') {
      return node.hasAttribute(name)
    }
  } catch (e) {
    // Ignore error, return false
  }
  return false
}

// Safely get node attributes
const safeGetAttributes = (
  node: any
): Array<{ name: string; value: string }> => {
  try {
    if (node && node.attributes && typeof node.attributes === 'object') {
      const result = []
      for (let i = 0; i < node.attributes.length; i++) {
        const attr = node.attributes[i]
        if (attr && attr.name && attr.value !== undefined) {
          result.push({ name: attr.name, value: attr.value })
        }
      }
      return result
    }
  } catch (e) {
    // Ignore error, return empty array
  }
  return []
}

function parseXmlToSlateNode(node: any): SlateNode {
  const type = safeGetAttribute(node, 'type') || node.nodeName
  const isMdxNode = type.startsWith('mdxJsx')
  const name = isMdxNode ? node.nodeName : undefined
  const slateNode: SlateNode = { type, name }

  if (safeHasAttribute(node, 'id')) {
    slateNode.id = safeGetAttribute(node, 'id')!
  }

  if (node.nodeName === 'bold' || node.nodeName === 'italic') {
    return {
      type: 'text',
      text: node.textContent || '',
      bold: node.nodeName === 'bold' ? true : undefined,
      italic: node.nodeName === 'italic' ? true : undefined,
    }
  }

  if (node.childNodes && node.childNodes.length > 0) {
    const childNodes = []
    for (let i = 0; i < node.childNodes.length; i++) {
      const childNode = node.childNodes[i]
      if (!childNode) continue
      if (childNode.nodeType === 1) {
        childNodes.push(parseXmlToSlateNode(childNode))
      } else if (
        childNode.nodeType === 3 &&
        !childNode?.nodeValue?.startsWith('\n')
      ) {
        childNodes.push({
          type: 'text',
          text: childNode.nodeValue || '',
        })
      }
    }
    if (isMdxNode) {
      slateNode.children = [
        {
          type: 'text',
          text: '',
        },
      ]
      slateNode.props = {
        content: {
          type: 'root',
          children: childNodes,
        },
      }
    } else {
      slateNode.children = childNodes
    }
  }

  if (type === 'img' || type === 'a') {
    // This might need better handling, e.g. parsing the "title" of a link etc
    slateNode.url = safeGetAttribute(node, 'url') || ''
    slateNode.alt = safeGetAttribute(node, 'alt') || undefined
    slateNode.caption = safeGetAttribute(node, 'caption') || undefined
  } else {
    // Get attributes safely
    const attributes = safeGetAttributes(node)
    if (attributes.length > 0) {
      slateNode.props = slateNode.props || {}
      for (const attr of attributes) {
        if (attr.name !== 'id' && attr.name !== 'type') {
          slateNode.props[attr.name] = attr.value
        }
      }
    }
  }

  return slateNode
}

export function parseFromXml(xml: string): SlateNode {
  try {
    const parser = new DOMParser({
      // Use a simple error handler that ignores errors
      errorHandler: () => {},
    })
    const doc = parser.parseFromString(xml, 'text/xml')
    const root = doc.documentElement

    if (!root) {
      return {
        type: 'root',
        children: [],
      }
    }

    const childNodes = Array.from(root.childNodes)
    const children = childNodes
      .filter((node) => node.nodeType === 1)
      .map((node) => parseXmlToSlateNode(node))

    // Create the root node with the parsed children
    return {
      type: 'root',
      children,
    }
  } catch (err: any) {
    throw new RichTextParseError(err.message || 'Error parsing XML')
  }
}
