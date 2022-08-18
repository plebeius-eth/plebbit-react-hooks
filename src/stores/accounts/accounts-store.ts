import assert from 'assert'
import Debug from 'debug'
const debug = Debug('plebbit-react-hooks:stores:accounts')
import accountsDatabase from './accounts-database'
import accountGenerator from './account-generator'
import {Subplebbit, AccountNamesToAccountIds, Account, Accounts, AccountsActions, Comment, AccountComment, AccountsComments, AccountsCommentsReplies} from '../../types'
import createStore from 'zustand'
import * as accountsActions from './accounts-actions'
import * as accountsActionsInternal from './accounts-actions-internal'
import localForage from 'localforage'

// reset all event listeners in between tests
export const listeners: any = []

type AccountsState = {
  accounts: Accounts
  accountIds: string[]
  activeAccountId: string | undefined
  accountNamesToAccountIds: AccountNamesToAccountIds
  accountsComments: AccountsComments
  accountsCommentsUpdating: {[commendCid: string]: boolean}
  accountsCommentsReplies: AccountsCommentsReplies
  accountsVotes: any
  accountsActions: {[key: string]: Function}
  accountsActionsInternal: {[key: string]: Function}
}

const accountsStore = createStore<AccountsState>((setState: Function, getState: Function) => ({
  accounts: {},
  accountIds: [],
  activeAccountId: undefined,
  accountNamesToAccountIds: {},
  accountsComments: {},
  accountsCommentsUpdating: {},
  accountsCommentsReplies: {},
  accountsVotes: {},
  accountsActions,
  accountsActionsInternal,
}))

// load accounts from database once on load
const initializeAccountsStore = async () => {
  let accountIds: string[] | undefined
  let activeAccountId: string | undefined
  let accounts: Accounts
  let accountNamesToAccountIds: AccountNamesToAccountIds | undefined
  accountIds = (await accountsDatabase.accountsMetadataDatabase.getItem('accountIds')) || undefined
  // get accounts from database if any
  if (accountIds?.length) {
    ;[activeAccountId, accounts, accountNamesToAccountIds] = await Promise.all<any>([
      accountsDatabase.accountsMetadataDatabase.getItem('activeAccountId'),
      accountsDatabase.getAccounts(accountIds),
      accountsDatabase.accountsMetadataDatabase.getItem('accountNamesToAccountIds'),
    ])
  }
  // no accounts in database, create a default account
  else {
    const defaultAccount = await accountGenerator.generateDefaultAccount()
    await accountsDatabase.addAccount(defaultAccount)
    accounts = {[defaultAccount.id]: defaultAccount}
    ;[accountIds, activeAccountId, accountNamesToAccountIds] = await Promise.all<any>([
      accountsDatabase.accountsMetadataDatabase.getItem('accountIds'),
      accountsDatabase.accountsMetadataDatabase.getItem('activeAccountId'),
      accountsDatabase.accountsMetadataDatabase.getItem('accountNamesToAccountIds'),
    ])
    assert(
      accountIds && activeAccountId && accountNamesToAccountIds,
      `accountsStore error creating a default account during initialization accountsMetadataDatabase.accountIds '${accountIds}' accountsMetadataDatabase.activeAccountId '${activeAccountId}' accountsMetadataDatabase.accountNamesToAccountIds '${JSON.stringify(
        accountNamesToAccountIds
      )}'`
    )
  }
  const [accountsComments, accountsVotes, accountsCommentsReplies] = await Promise.all<any>([
    accountsDatabase.getAccountsComments(accountIds),
    accountsDatabase.getAccountsVotes(accountIds),
    accountsDatabase.getAccountsCommentsReplies(accountIds),
  ])
  accountsStore.setState((state) => ({accounts, accountIds, activeAccountId, accountNamesToAccountIds, accountsComments, accountsVotes, accountsCommentsReplies}))

  // start looking for updates for all accounts comments in database
  for (const accountId in accountsComments) {
    for (const accountComment of accountsComments[accountId]) {
      accountsStore
        .getState()
        .accountsActionsInternal.startUpdatingAccountCommentOnCommentUpdateEvents(accountComment, accounts[accountId], accountComment.index)
        .catch((error: unknown) =>
          console.error('accountsStore.initializeAccountsStore startUpdatingAccountCommentOnCommentUpdateEvents error', {
            accountComment,
            accountCommentIndex: accountComment.index,
            accounts,
            error,
          })
        )
    }
  }
}

// TODO: find way to test started subplebbits
// poll all local subplebbits and start them if they are not started
let startSubplebbitsInterval: any
let startedSubplebbits: {[subplebbitAddress: string]: Subplebbit} = {}
let pendingStartedSubplebbits: {[subplebbitAddress: string]: boolean} = {}
const initializeStartSubplebbits = async () => {
  // if re-initializing, clear previous interval
  if (startSubplebbitsInterval) {
    clearInterval(startSubplebbitsInterval)
  }

  // if re-initializing, stop all started subplebbits
  for (const subplebbitAddress in startedSubplebbits) {
    try {
      await startedSubplebbits[subplebbitAddress].stop()
    } catch (error) {
      console.error('accountsStore subplebbit.stop error', {subplebbitAddress, error})
    }
  }

  // don't start subplebbits twice
  startedSubplebbits = {}
  pendingStartedSubplebbits = {}

  const startSubplebbitsPollTime = 10000
  startSubplebbitsInterval = setInterval(() => {
    const {accounts, activeAccountId} = accountsStore.getState()
    const account = activeAccountId && accounts?.[activeAccountId]
    if (!account?.plebbit) {
      return
    }
    account.plebbit.listSubplebbits().then(async (subplebbitAddresses: string[]) => {
      for (const subplebbitAddress of subplebbitAddresses) {
        if (startedSubplebbits[subplebbitAddress] || pendingStartedSubplebbits[subplebbitAddress]) {
          continue
        }
        pendingStartedSubplebbits[subplebbitAddress] = true
        try {
          const subplebbit = await account.plebbit.createSubplebbit({address: subplebbitAddress})
          await subplebbit.start()
          startedSubplebbits[subplebbitAddress] = subplebbit
          debug('subplebbit started', {subplebbit})
        } catch (error) {
          console.error('accountsStore subplebbit.start error', {subplebbitAddress, error})
        }
        pendingStartedSubplebbits[subplebbitAddress] = false
      }
    })
  }, startSubplebbitsPollTime)
}

// @ts-ignore
const isInitializing = () => !!window.PLEBBIT_REACT_HOOKS_ACCOUNTS_STORE_INITIALIZING

;(async () => {
  // don't initialize on load multiple times when loading the file multiple times during karma tests
  // @ts-ignore
  if (window.PLEBBIT_REACT_HOOKS_ACCOUNTS_STORE_INITIALIZED_ONCE) {
    return
  }

  // @ts-ignore
  window.PLEBBIT_REACT_HOOKS_ACCOUNTS_STORE_INITIALIZED_ONCE = true
  // @ts-ignore
  window.PLEBBIT_REACT_HOOKS_ACCOUNTS_STORE_INITIALIZING = true

  debug('accounts store initializing started')
  try {
    await initializeAccountsStore()
  } catch (error) {
    // initializing can fail in tests when store is being reset at the same time as databases are being deleted
    console.error('accountsStore.initializeAccountsStore error', {accountsStore: accountsStore.getState(), error})
  } finally {
    // @ts-ignore
    delete window.PLEBBIT_REACT_HOOKS_ACCOUNTS_STORE_INITIALIZING
  }
  debug('accounts store initializing finished')

  await initializeStartSubplebbits()
})()

// reset store in between tests
const originalState = accountsStore.getState()
// async function because some stores have async init
export const resetAccountsStore = async () => {
  // don't reset while initializing, it could happen during quick successive tests
  while (isInitializing()) {
    console.warn(`can't reset accounts store while initializing, waiting 100ms`)
    await new Promise((r) => setTimeout(r, 100))
  }

  debug('accounts store reset started')

  // remove all event listeners
  listeners.forEach((listener: any) => listener.removeAllListeners())
  // destroy all component subscriptions to the store
  accountsStore.destroy()
  // restore original state
  accountsStore.setState(originalState)
  // init the store
  await initializeAccountsStore()
  // init start subplebbits
  await initializeStartSubplebbits()

  debug('accounts store reset finished')
}

// reset database and store in between tests
export const resetAccountsDatabaseAndStore = async () => {
  // don't reset while initializing, it could happen during quick successive tests
  while (isInitializing()) {
    console.warn(`can't reset accounts database while initializing, waiting 100ms`)
    await new Promise((r) => setTimeout(r, 100))
  }
  await Promise.all([localForage.createInstance({name: 'accountsMetadata'}).clear(), localForage.createInstance({name: 'accounts'}).clear()])
  await resetAccountsStore()
}

export default accountsStore
