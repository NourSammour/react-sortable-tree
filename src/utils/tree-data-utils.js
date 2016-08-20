/**
 * Performs a depth-first traversal over all of the node descendants,
 * incrementing currentIndex by 1 for each
 */
function getNodeDataAtTreeIndexOrNextIndex({
    node,
    currentIndex,
    targetIndex,
    getNodeKey,
    path = [],
    lowerSiblingCounts = [],
    ignoreCollapsed = true,
    isPseudoRoot = false,
}) {
    // The pseudo-root is not considered in the path
    const selfPath = !isPseudoRoot ? [...path, getNodeKey({ node, treeIndex: currentIndex })] : [];

    // Return target node when found
    if (currentIndex === targetIndex) {
        return {
            node,
            lowerSiblingCounts,
            path: selfPath,
        };
    }

    // Add one and continue for nodes with no children or hidden children
    if (!node.children || (ignoreCollapsed && node.expanded !== true)) {
        return { nextIndex: currentIndex + 1 };
    }

    // Iterate over each child and their ancestors and return the
    // target node if childIndex reaches the targetIndex
    let childIndex   = currentIndex + 1;
    const childCount = node.children.length;
    for (let i = 0; i < childCount; i++) {
        const result = getNodeDataAtTreeIndexOrNextIndex({
            targetIndex,
            getNodeKey,
            node: node.children[i],
            currentIndex: childIndex,
            lowerSiblingCounts: [ ...lowerSiblingCounts, childCount - i - 1 ],
            path: selfPath,
        });

        if (result.node) {
            return result;
        }

        childIndex = result.nextIndex;
    }

    // If the target node is not found, return the farthest traversed index
    return { nextIndex: childIndex };
}

/**
 * Walk all descendants of the given node
 */
function walkDescendants({
    callback,
    getNodeKey,
    ignoreCollapsed,
    isPseudoRoot = false,
    node,
    currentIndex,
    path = [],
    lowerSiblingCounts = [],
}) {
    // The pseudo-root is not considered in the path
    const selfPath = !isPseudoRoot ? [ ...path, getNodeKey({ node, treeIndex: currentIndex }) ] : [];
    const selfInfo = !isPseudoRoot ? { node, path: selfPath, lowerSiblingCounts, treeIndex: currentIndex } : null;
    if (!isPseudoRoot) {
        const callbackResult = callback(selfInfo);

        // Cut walk short if the callback returned false
        if (callbackResult === false) {
            return false;
        }
    }

    // Return self on nodes with no children or hidden children
    if (!node.children || (node.expanded !== true && ignoreCollapsed && !isPseudoRoot)) {
        return currentIndex;
    }

    // Get all descendants
    let childIndex   = currentIndex;
    const childCount = node.children.length;
    if (typeof node.children !== 'function') {
        for (let i = 0; i < childCount; i++) {
            childIndex = walkDescendants({
                callback,
                getNodeKey,
                ignoreCollapsed,
                node: node.children[i],
                currentIndex: childIndex + 1,
                lowerSiblingCounts: [ ...lowerSiblingCounts, childCount - i - 1 ],
                path: selfPath,
            });

            // Cut walk short if the callback returned false
            if (childIndex === false) {
                return false;
            }
        }
    }

    // Flatten all descendant arrays into a single flat array
    return childIndex;
}

/**
 * Count all the visible (expanded) descendants in the tree data.
 *
 * @param {!Object[]} treeData - Tree data
 *
 * @return {number} count
 */
export function getVisibleNodeCount({ treeData }) {
    const traverse = (node) => {
        if (!node.children || node.expanded !== true || (typeof node.children === 'function')) {
            return 1;
        }

        return 1 + node.children.reduce((total, currentNode) => (total + traverse(currentNode)), 0);
    };

    return treeData.reduce((total, currentNode) => total + traverse(currentNode), 0);
}

/**
 * Get the <targetIndex>th visible node in the tree data.
 *
 * @param {!Object[]} treeData - Tree data
 * @param {!number} targetIndex - The index of the node to search for
 * @param {function} getNodeKey - Function to get the key from the nodeData and tree index
 *
 * @return {{
 *      node: Object,
 *      path: []string|[]number,
 *      lowerSiblingCounts: []number
 *  }|null} node - The node at targetIndex, or null if not found
 */
export function getVisibleNodeInfoAtIndex({ treeData, index: targetIndex, getNodeKey }) {
    if (!treeData || treeData.length < 1) {
        return null;
    }

    // Call the tree traversal with a pseudo-root node
    const result = getNodeDataAtTreeIndexOrNextIndex({
        targetIndex,
        getNodeKey,
        node: {
            children: treeData,
            expanded: true,
        },
        currentIndex: -1,
        path: [],
        lowerSiblingCounts: [],
        isPseudoRoot: true,
    });

    if (result.node) {
        return result;
    }

    return null;
}

/**
 * Walk descendants depth-first and call a callback on each
 *
 * @param {!Object[]} treeData - Tree data
 * @param {function} getNodeKey - Function to get the key from the nodeData and tree index
 * @param {function} callback - Function to call on each node
 * @param {boolean=} ignoreCollapsed - Ignore children of nodes without `expanded` set to `true`
 */
export function walk({ treeData, getNodeKey, callback, ignoreCollapsed = true }) {
    if (!treeData || treeData.length < 1) {
        return;
    }

    return walkDescendants({
        callback,
        getNodeKey,
        ignoreCollapsed,
        isPseudoRoot: true,
        node: { children: treeData },
        currentIndex: -1,
        path: [],
        lowerSiblingCounts: [],
    });
}

/**
 * Get visible node data flattened.
 *
 * @param {!Object[]} treeData - Tree data
 * @param {function} getNodeKey - Function to get the key from the nodeData and tree index
 *
 * @return {{
 *      node: Object,
 *      path: []string|[]number,
 *      lowerSiblingCounts: []number
 *  }}[] nodes - The node array
 */
export function getVisibleNodeInfoFlattened({ treeData, getNodeKey }) {
    if (!treeData || treeData.length < 1) {
        return [];
    }

    const flattened = [];
    walk({
        treeData,
        getNodeKey,
        ignoreCollapsed: true,
        callback: ({ node, lowerSiblingCounts, path, treeIndex }) => {
            flattened[treeIndex] = { node, lowerSiblingCounts, path };
        },
    });

    return flattened;
}

/**
 * Replaces node at path with object, or callback-defined object
 *
 * @param {!Object[]} treeData
 * @param {number[]|string[]} path - Array of keys leading up to node to be changed
 * @param {function|any} newNode - Node to replace the node at the path with, or a function producing the new node
 * @param {function} getNodeKey - Function to get the key from the nodeData and tree index
 * @param {boolean=} ignoreCollapsed - Ignore children of nodes without `expanded` set to `true`
 *
 * @return {Object} changedTreeData - The updated tree data
 */
export function changeNodeAtPath({ treeData, path, newNode, getNodeKey, ignoreCollapsed = true }) {
    const RESULT_MISS = 'RESULT_MISS';
    const traverse = ({
        isPseudoRoot = false,
        node,
        currentTreeIndex,
        pathIndex,
    }) => {
        if (!isPseudoRoot && getNodeKey({ node, treeIndex: currentTreeIndex }) !== path[pathIndex]) {
            return RESULT_MISS;
        }

        if (pathIndex >= path.length - 1) {
            // If this is the final location in the path, return its changed form
            return typeof newNode === 'function' ? newNode({ node, treeIndex: currentTreeIndex }) : newNode;
        } else if (!node.children) {
            // If this node is part of the path, but has no children, return the unchanged node
            throw new Error('Path referenced children of node with no children.');
        }


        let nextTreeIndex = currentTreeIndex + 1;
        for (let i = 0; i < node.children.length; i++) {
            const result = traverse({
                node:             node.children[i],
                currentTreeIndex: nextTreeIndex,
                pathIndex:        pathIndex + 1,
            });

            // If the result went down the correct path
            if (result !== RESULT_MISS) {
                if (result) {
                    // If the result was truthy (in this case, an object),
                    //  pass it to the next level of recursion up
                    return {
                        ...node,
                        children: [
                            ...node.children.slice(0, i),
                            result,
                            ...node.children.slice(i + 1),
                        ],
                    };
                }
                // If the result was falsy (returned from the newNode function), then
                //  delete the node from the array.
                return {
                    ...node,
                    children: [
                        ...node.children.slice(0, i),
                        ...node.children.slice(i + 1),
                    ],
                };
            }

            nextTreeIndex = getNodeDataAtTreeIndexOrNextIndex({
                getNodeKey,
                ignoreCollapsed,
                node:            node.children[i],
                currentIndex:    nextTreeIndex,
                targetIndex:     -1,
            }).nextIndex;
        }

        return RESULT_MISS;
    };

    // Use a pseudo-root node in the beginning traversal
    const result = traverse({
        node: { children: treeData },
        currentTreeIndex: -1,
        pathIndex: -1,
        isPseudoRoot: true,
    });

    if (result === RESULT_MISS) {
        throw new Error('No node found at the given path.');
    }

    return result.children;
}


/**
 * Removes the node at the specified path and returns the resulting treeData.
 *
 * @param {!Object[]} treeData
 * @param {number[]|string[]} path - Array of keys leading up to node to be deleted
 * @param {function} getNodeKey - Function to get the key from the nodeData and tree index
 * @param {boolean=} ignoreCollapsed - Ignore children of nodes without `expanded` set to `true`
 *
 * @return {Object} changedTreeData - The updated tree data
 */
export function removeNodeAtPath({ treeData, path, getNodeKey, ignoreCollapsed = true }) {
    return changeNodeAtPath({
        treeData,
        path,
        getNodeKey,
        ignoreCollapsed,
        newNode: null, // Delete the node
    });
}

/**
 * Adds the node to the specified parent and returns the resulting treeData.
 *
 * @param {!Object[]} treeData
 * @param {!Object} newNode - The node to insert
 * @param {number[]|string[]} path - Array of keys leading up to node to be deleted
 * @param {function} getNodeKey - Function to get the key from the nodeData and tree index
 * @param {boolean=} ignoreCollapsed - Ignore children of nodes without `expanded` set to `true`
 *
 * @return {Object} changedTreeData - The updated tree data
 */
export function addNodeUnderParentPath({
    treeData,
    newNode,
    newParentPath,
    newChildIndex,
    getNodeKey,
    ignoreCollapsed = true
}) {
    // return changeNodeAtPath({
    //     treeData,
    //     path: newParentPath,
    //     getNodeKey,
    //     ignoreCollapsed,
    //     newNode: (node) => typeof node.children === 'object' ? , // Delete the node
    // });
}

// Performs change to every node in the tree