import {useEffect, useState, useMemo} from 'react'
import {useAccount} from './accounts'
import validator from '../lib/validator'
import Logger from '@plebbit/plebbit-logger'
const log = Logger('plebbit-react-hooks:hooks:comments')
import assert from 'assert'
import {Comment} from '../types'
import useCommentsStore from '../stores/comments'
import useSubplebbitsPagesStore from '../stores/subplebbits-pages'
import shallow from 'zustand/shallow'

/**
 * @param commentCid - The IPFS CID of the comment to get
 * @param acountName - The nickname of the account, e.g. 'Account 1'. If no accountName is provided, use
 * the active account.
 */
export function useComment(commentCid?: string, accountName?: string) {
  const account = useAccount(accountName)
  let comment = useCommentsStore((state: any) => state.comments[commentCid || ''])
  const addCommentToStore = useCommentsStore((state: any) => state.addCommentToStore)
  const subplebbitsPagesComment = useSubplebbitsPagesStore((state: any) => state.comments[commentCid || ''])

  useEffect(() => {
    if (!commentCid || !account) {
      return
    }
    validator.validateUseCommentArguments(commentCid, account)
    if (!comment) {
      // if comment isn't already in store, add it
      addCommentToStore(commentCid, account).catch((error: unknown) => log.error('useComment addCommentToStore error', {commentCid, error}))
    }
  }, [commentCid, account?.id])

  if (account && commentCid) {
    log('useComment', {commentCid, comment, commentsStore: useCommentsStore.getState().comments, account})
  }

  // if comment from subplebbit pages is more recent, use it instead
  if (commentCid && (subplebbitsPagesComment?.updatedAt || 0) > (comment?.updatedAt || 0)) {
    comment = subplebbitsPagesComment
  }

  return comment
}

/**
 * @param commentCids - The IPFS CIDs of the comments to get
 * @param acountName - The nickname of the account, e.g. 'Account 1'. If no accountName is provided, use
 * the active account.
 */
export function useComments(commentCids: string[] = [], accountName?: string) {
  const account = useAccount(accountName)
  const comments: Comment[] = useCommentsStore((state: any) => commentCids.map((commentCid) => state.comments[commentCid || '']), shallow)
  const subplebbitsPagesComments: Comment[] = useSubplebbitsPagesStore((state: any) => commentCids.map((commentCid) => state.comments[commentCid || '']), shallow)

  const addCommentToStore = useCommentsStore((state: any) => state.addCommentToStore)

  useEffect(() => {
    if (!commentCids || !account) {
      return
    }
    validator.validateUseCommentsArguments(commentCids, account)
    const uniqueCommentCids = new Set(commentCids)
    for (const commentCid of uniqueCommentCids) {
      addCommentToStore(commentCid, account).catch((error: unknown) => log.error('useComments addCommentToStore error', {commentCid, error}))
    }
  }, [commentCids.toString(), account?.id])

  if (account && commentCids?.length) {
    log('useComments', {commentCids, comments, commentsStore: useCommentsStore.getState().comments, account})
  }

  // if comment from subplebbit pages is more recent, use it instead
  const _comments = useMemo(() => {
    const _comments = [...comments]
    for (const i in _comments) {
      if ((subplebbitsPagesComments[i]?.updatedAt || 0) > (_comments[i]?.updatedAt || 0)) {
        _comments[i] = subplebbitsPagesComments[i]
      }
    }
    return _comments
  }, [comments, subplebbitsPagesComments])

  return _comments
}
