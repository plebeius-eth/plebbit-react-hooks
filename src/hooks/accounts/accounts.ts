import {useMemo, useState} from 'react'
import isEqual from 'lodash.isequal'
import useAccountsStore from '../../stores/accounts'
import Logger from '@plebbit/plebbit-logger'
const log = Logger('plebbit-react-hooks:accounts:hooks')
import assert from 'assert'
import {useListSubplebbits, useSubplebbits} from '../subplebbits'
import type {
  AccountComments,
  Account,
  Accounts,
  AccountVote,
  AccountsComments,
  AccountsCommentsReplies,
  UseAccountSubplebbitsOptions,
  UseAccountSubplebbitsResult,
  UseAccountVoteOptions,
  UseAccountVoteResult,
  UseAccountVotesOptions,
  UseAccountVotesResult,
  UseAccountCommentsOptions,
  UseAccountCommentsResult,
  UseAccountCommentOptions,
  UseAccountCommentResult,
  UseNotificationsOptions,
  UseNotificationsResult,
  UseAccountEditsOptions,
  UseAccountEditsResult,
  UseEditedCommentOptions,
  UseEditedCommentResult,
  UseAccountOptions,
  UseAccountResult,
} from '../../types'
import {filterPublications, useAccountsWithCalculatedProperties, useAccountWithCalculatedProperties, useCalculatedNotifications} from './utils'

/**
 * @param accountName - The nickname of the account, e.g. 'Account 1'. If no accountName is provided, return
 * the active account id.
 */
export function useAccountId(accountName?: string) {
  const accountId = useAccountsStore((state) => state.accountNamesToAccountIds[accountName || ''])
  // don't consider active account if account name is defined
  const activeAccountId = useAccountsStore((state) => !accountName && state.activeAccountId)
  const accountIdToUse = accountName ? accountId : activeAccountId
  return accountIdToUse
}

/**
 * @param accountName - The nickname of the account, e.g. 'Account 1'. If no accountName is provided, return
 * the active account.
 */
export function useAccount(options?: UseAccountOptions): UseAccountResult {
  const {accountName} = options || {}
  // get state
  const accountId = useAccountId(accountName)
  const accountStore = useAccountsStore((state) => state.accounts[accountId || ''])
  const accountComments = useAccountsStore((state) => state.accountsComments[accountId || ''])
  const accountCommentsReplies = useAccountsStore((state) => state.accountsCommentsReplies[accountId || ''])
  const account = useAccountWithCalculatedProperties(accountStore, accountComments, accountCommentsReplies)
  log('useAccount', {accountId, account, accountName})
  return account
}

/**
 * Return all accounts in the order of `accountsStore.accountIds`. To reorder, use `accountsActions.setAccountsOrder(accountNames)`.
 */
export function useAccounts() {
  const accountIds = useAccountsStore((state) => state.accountIds)
  const accountsStore = useAccountsStore((state) => state.accounts)
  const accountsComments = useAccountsStore((state) => state.accountsComments)
  const accountsCommentsReplies = useAccountsStore((state) => state.accountsCommentsReplies)
  const accounts = useAccountsWithCalculatedProperties(accountsStore, accountsComments, accountsCommentsReplies)
  const accountsArray: Account[] = useMemo(() => {
    const accountsArray = []
    if (accountIds?.length && accounts) {
      for (const accountId of accountIds) {
        accountsArray.push(accounts[accountId])
      }
    }
    return accountsArray
  }, [accounts, accountIds])

  log('useAccounts', {accounts, accountIds})

  const state = accountsArray?.length ? 'succeeded' : 'initializing'

  return useMemo(
    () => ({
      accounts: accountsArray,
      state,
      error: undefined,
      errors: [],
    }),
    [accountsArray, state]
  )
}

/**
 * Returns all subplebbits where the account is a creator or moderator
 */
export function useAccountSubplebbits(options?: UseAccountSubplebbitsOptions): UseAccountSubplebbitsResult {
  const {accountName} = options || {}
  const accountId = useAccountId(accountName)
  const accountsStoreAccountSubplebbits = useAccountsStore((state) => state.accounts[accountId || '']?.subplebbits)

  // get all unique account subplebbit addresses
  const ownerSubplebbitAddresses = useListSubplebbits()
  const uniqueSubplebbitAddresses: string[] = useMemo(() => {
    const accountSubplebbitAddresses = []
    if (accountsStoreAccountSubplebbits) {
      for (const subplebbitAddress in accountsStoreAccountSubplebbits) {
        accountSubplebbitAddresses.push(subplebbitAddress)
      }
    }
    const uniqueSubplebbitAddresses = [...new Set([...ownerSubplebbitAddresses, ...accountSubplebbitAddresses])].sort()
    return uniqueSubplebbitAddresses
  }, [accountsStoreAccountSubplebbits, ownerSubplebbitAddresses])

  // fetch all subplebbit data
  const {subplebbits: subplebbitsArray} = useSubplebbits({subplebbitAddresses: uniqueSubplebbitAddresses, accountName})
  const subplebbits: any = useMemo(() => {
    const subplebbits: any = {}
    for (const [i, subplebbit] of subplebbitsArray.entries()) {
      subplebbits[uniqueSubplebbitAddresses[i]] = {
        ...subplebbit,
        // make sure the address is defined if the subplebbit hasn't fetched yet
        address: uniqueSubplebbitAddresses[i],
      }
    }
    return subplebbits
  }, [subplebbitsArray, uniqueSubplebbitAddresses])

  // merged subplebbit data with account.subplebbits data
  const accountSubplebbits: any = useMemo(() => {
    const accountSubplebbits: any = {...subplebbits}
    if (accountsStoreAccountSubplebbits) {
      for (const subplebbitAddress in accountsStoreAccountSubplebbits) {
        accountSubplebbits[subplebbitAddress] = {
          ...accountSubplebbits[subplebbitAddress],
          ...accountsStoreAccountSubplebbits[subplebbitAddress],
        }
      }
    }
    // add listSubplebbits data
    for (const subplebbitAddress in accountSubplebbits) {
      if (ownerSubplebbitAddresses.includes(subplebbitAddress)) {
        accountSubplebbits[subplebbitAddress].role = {role: 'owner'}
      }
    }
    return accountSubplebbits
  }, [accountsStoreAccountSubplebbits, ownerSubplebbitAddresses, subplebbits])

  if (accountId) {
    log('useAccountSubplebbits', {accountSubplebbits})
  }

  const state = accountId ? 'succeeded' : 'initializing'

  return useMemo(
    () => ({
      accountSubplebbits,
      state,
      error: undefined,
      errors: [],
    }),
    [accountSubplebbits, state]
  )
}

/**
 * Returns an account's notifications in an array. Unread notifications have a field markedAsRead: false.
 *
 * @param accountName - The nickname of the account, e.g. 'Account 1'. If no accountName is provided, return
 * the active account's notifications.
 */
export function useNotifications(options?: UseNotificationsOptions): UseNotificationsResult {
  const {accountName} = options || {}
  // get state
  const accountId = useAccountId(accountName)
  const account = useAccountsStore((state) => state.accounts[accountId || ''])
  const accountCommentsReplies = useAccountsStore((state) => state.accountsCommentsReplies[accountId || ''])
  const accountsActionsInternal = useAccountsStore((state) => state.accountsActionsInternal)
  const notifications = useCalculatedNotifications(account, accountCommentsReplies)
  const [errors, setErrors] = useState<Error[]>([])

  const markAsRead = async () => {
    try {
      if (!account) {
        throw Error('useNotifications cannot mark as read accounts not initalized yet')
      }
      accountsActionsInternal.markNotificationsAsRead(account)
    } catch (e: any) {
      setErrors([...errors, e])
    }
  }

  if (account) {
    log('useNotifications', {notifications})
  }

  const state = accountId ? 'succeeded' : 'initializing'

  return useMemo(
    () => ({
      notifications,
      markAsRead,
      state,
      error: errors[errors.length - 1],
      errors,
    }),
    [notifications, errors]
  )
}

export function useAccountComments(options?: UseAccountCommentsOptions): UseAccountCommentsResult {
  const {accountName, filter} = options || {}
  const accountId = useAccountId(accountName)
  const accountComments = useAccountsStore((state) => state.accountsComments[accountId || ''])

  const filteredAccountComments = useMemo(() => {
    if (!accountComments) {
      return []
    }
    if (filter) {
      return filterPublications(accountComments, filter)
    }
    return accountComments
  }, [accountComments, filter])

  if (accountComments && options) {
    log('useAccountComments', {accountId, filteredAccountComments, accountComments, filter})
  }

  const state = accountId ? 'succeeded' : 'initializing'

  return useMemo(
    () => ({
      accountComments: filteredAccountComments,
      state,
      error: undefined,
      errors: [],
    }),
    [filteredAccountComments, state]
  )
}

/**
 * Returns an account's single comment, e.g. a pending comment they published.
 */
export function useAccountComment(options?: UseAccountCommentOptions): UseAccountCommentResult {
  const {commentIndex, accountName} = options || {}
  const {accountComments} = useAccountComments({accountName})
  const accountComment = useMemo(() => accountComments?.[Number(commentIndex)] || {}, [accountComments, commentIndex])
  const state = accountComments && commentIndex !== undefined ? 'succeeded' : 'initializing'

  return useMemo(
    () => ({
      ...accountComment,
      state,
      error: undefined,
      errors: [],
    }),
    [accountComment, state]
  )
}

/**
 * Returns the own user's votes stored locally, even those not yet published by the subplebbit owner.
 * Check UseAccountCommentsOptions type in types.tsx to filter them, e.g. filter = {subplebbitAddresses: ['memes.eth']}.
 */
export function useAccountVotes(options?: UseAccountVotesOptions): UseAccountVotesResult {
  const {accountName, filter} = options || {}
  const accountId = useAccountId(accountName)
  const accountVotes = useAccountsStore((state) => state.accountsVotes[accountId || ''])

  const filteredAccountVotesArray = useMemo(() => {
    let accountVotesArray: AccountVote[] = []
    if (!accountVotes) {
      return accountVotesArray
    }
    for (const i in accountVotes) {
      accountVotesArray.push(accountVotes[i])
    }
    if (filter) {
      accountVotesArray = filterPublications(accountVotesArray, filter)
    }
    return accountVotesArray
  }, [accountVotes, filter])

  if (accountVotes && filter) {
    log('useAccountVotes', {accountId, filteredAccountVotesArray, accountVotes, filter})
  }

  const state = accountId ? 'succeeded' : 'initializing'

  return useMemo(
    () => ({
      accountVotes: filteredAccountVotesArray,
      state,
      error: undefined,
      errors: [],
    }),
    [filteredAccountVotesArray, state]
  )
}

/**
 * Returns an account's single vote on a comment, e.g. to know if you already voted on a comment.
 */
export function useAccountVote(options?: UseAccountVoteOptions): UseAccountVoteResult {
  const {commentCid, accountName} = options || {}
  const accountId = useAccountId(accountName)
  const accountVotes = useAccountsStore((state) => state.accountsVotes[accountId || ''])
  const accountVote: any = accountVotes?.[commentCid || '']
  const state = accountId && commentCid ? 'succeeded' : 'initializing'

  return useMemo(
    () => ({
      ...accountVote,
      state,
      error: undefined,
      errors: [],
    }),
    [accountVote, state]
  )
}

/**
 * Returns all the comment and subplebbit edits published by an account.
 */
export function useAccountEdits(options?: UseAccountEditsOptions): UseAccountEditsResult {
  const {filter, accountName} = options || {}
  const accountId = useAccountId(accountName)
  const accountEdits = useAccountsStore((state) => state.accountsEdits[accountId || ''])

  const accountEditsArray = useMemo(() => {
    const accountEditsArray = []
    for (const i in accountEdits) {
      accountEditsArray.push(...accountEdits[i])
    }
    // sort by oldest first
    return accountEditsArray.sort((a, b) => a.timestamp - b.timestamp)
  }, [accountEdits])

  const filteredAccountEditsArray = useMemo(() => {
    if (!filter) {
      return accountEditsArray
    }
    return filterPublications(accountEditsArray, filter)
  }, [accountEditsArray, filter])

  const state = accountId ? 'succeeded' : 'initializing'

  return useMemo(
    () => ({
      accountEdits: filteredAccountEditsArray,
      state,
      error: undefined,
      errors: [],
    }),
    [accountEditsArray, filter, state]
  )
}

/**
 * Returns the comment edited (if has any edits), as well as the pending, succeeded or failed state of the edit.
 */
export function useEditedComment(options?: UseEditedCommentOptions): UseEditedCommentResult {
  const {comment, accountName} = options || {}
  const accountId = useAccountId(accountName)
  const commentEdits = useAccountsStore((state) => state.accountsEdits[accountId || '']?.[comment?.cid || ''])

  let initialState = 'initializing'
  if (accountId && comment?.cid) {
    initialState = 'unedited'
  }

  const editedResult = useMemo(() => {
    const editedResult: any = {
      editedComment: undefined,
      succeededEdits: {},
      pendingEdits: {},
      failedEdits: {},
      state: undefined,
    }

    // there are no edits
    if (!commentEdits?.length) {
      return editedResult
    }

    // don't include these props as they are not edit props, they are publication props
    const nonEditPropertyNames = new Set(['author, signer', 'commentCid', 'subplebbitAddress', 'timestamp'])

    // iterate over commentEdits and consolidate them into 1 propertyNameEdits object
    const propertyNameEdits: any = {}
    for (const commentEdit of commentEdits) {
      for (const propertyName in commentEdit) {
        // not valid edited properties
        if (commentEdit[propertyName] === undefined || nonEditPropertyNames.has(propertyName)) {
          continue
        }
        const previousTimestamp = propertyNameEdits[propertyName]?.timestamp || 0
        // only use the latest propertyNameEdit timestamp
        if (commentEdit.timestamp > previousTimestamp) {
          propertyNameEdits[propertyName] = {
            timestamp: commentEdit.timestamp,
            value: commentEdit[propertyName],
            // NOTE: don't use comment edit challengeVerification.challengeSuccess
            // to know if an edit has failed or succeeded, since another mod can also edit
            // if another mod overrides an edit, consider the edit failed
          }
        }
      }
    }

    const now = Math.round(Date.now() / 1000)
    // no longer consider an edit pending ater an expiry time of 20 minutes
    const expiryTime = 60 * 20

    // iterate over propertyNameEdits and find if succeeded, pending or failed
    for (const propertyName in propertyNameEdits) {
      const propertyNameEdit = propertyNameEdits[propertyName]

      const setPropertyNameEditState = (state: 'succeeded' | 'pending' | 'failed') => {
        // set propertyNameEdit e.g. editedResult.succeededEdits.removed = true
        editedResult[`${state}Edits`][propertyName] = propertyNameEdit.value

        // if any propertyNameEdit failed, consider the commentEdit failed
        if (state === 'failed') {
          editedResult.state = 'failed'
        }
        // if all propertyNameEdit succeeded, consider the commentEdit succeeded
        if (state === 'succeeded' && !editedResult.state) {
          editedResult.state = 'succeeded'
        }
        // if any propertyNameEdit are pending, and none have failed, consider the commentEdit pending
        if (state === 'pending' && editedResult.state !== 'failed') {
          editedResult.state = 'pending'
        }
        if (!editedResult.state) {
          throw Error(`didn't define editedResult.state`)
        }
      }

      // comment update hasn't been received, impossible to evaluate the status of a comment edit
      // better to show pending than unedited, otherwise the editor might try to edit again
      if (!comment?.updatedAt) {
        setPropertyNameEditState('pending')
        continue
      }

      // comment.updatedAt is older than propertyNameEdit, propertyNameEdit is pending
      // because we haven't received the update yet and can't evaluate
      if (comment.updatedAt < propertyNameEdit.timestamp) {
        setPropertyNameEditState('pending')
        continue
      }

      // comment.updatedAt is newer than propertyNameEdit, a comment update
      // has been received after the edit was published so we can evaluate
      else {
        // comment has propertyNameEdit, propertyNameEdit succeeded
        if (isEqual(comment[propertyName], propertyNameEdit.value)) {
          setPropertyNameEditState('succeeded')
          continue
        }

        // comment does not have propertyNameEdit
        else {
          // propertyNameEdit is newer than 20min, it is too recent to evaluate
          // so we should assume pending
          if (propertyNameEdit.timestamp > now - expiryTime) {
            setPropertyNameEditState('pending')
            continue
          }

          // propertyNameEdit is older than 20min, we can evaluate it
          else {
            // comment update was received too shortly after propertyNameEdit was
            // published, assume pending until a more recent comment update is received
            const timeSinceUpdate = comment.updatedAt - propertyNameEdit.timestamp
            if (timeSinceUpdate < expiryTime) {
              setPropertyNameEditState('pending')
              continue
            }

            // comment update time is sufficiently distanced from propertyNameEdit
            // and comment doesn't have propertyNameEdit, assume failed
            else {
              setPropertyNameEditState('failed')
              continue
            }
          }
        }
      }
    }

    // define editedComment
    editedResult.editedComment = {...comment}
    // add pending and succeeded props so the editor can see his changes right away
    // don't add failed edits to reflect the current state of the edited comment
    for (const propertyName in editedResult.pendingEdits) {
      editedResult.editedComment[propertyName] = editedResult.pendingEdits[propertyName]
    }
    for (const propertyName in editedResult.succeededEdits) {
      editedResult.editedComment[propertyName] = editedResult.succeededEdits[propertyName]
    }

    return editedResult
  }, [comment, commentEdits])

  return useMemo(
    () => ({
      ...editedResult,
      state: editedResult.state || initialState,
      error: undefined,
      errors: [],
    }),
    [editedResult, initialState]
  )
}
