var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import assert from 'assert';
import Debug from 'debug';
const debug = Debug('plebbit-react-hooks:stores:accounts');
import accountsDatabase from './accounts-database';
import accountGenerator from './account-generator';
import createStore from 'zustand';
import * as accountsActions from './accounts-actions';
import * as accountsActionsInternal from './accounts-actions-internal';
import localForage from 'localforage';
// reset all event listeners in between tests
export const listeners = [];
const useAccountsStore = createStore((setState, getState) => ({
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
}));
// load accounts from database once on load
const initializeAccountsStore = () => __awaiter(void 0, void 0, void 0, function* () {
    let accountIds;
    let activeAccountId;
    let accounts;
    let accountNamesToAccountIds;
    accountIds = (yield accountsDatabase.accountsMetadataDatabase.getItem('accountIds')) || undefined;
    // get accounts from database if any
    if (accountIds === null || accountIds === void 0 ? void 0 : accountIds.length) {
        ;
        [activeAccountId, accounts, accountNamesToAccountIds] = yield Promise.all([
            accountsDatabase.accountsMetadataDatabase.getItem('activeAccountId'),
            accountsDatabase.getAccounts(accountIds),
            accountsDatabase.accountsMetadataDatabase.getItem('accountNamesToAccountIds'),
        ]);
    }
    // no accounts in database, create a default account
    else {
        const defaultAccount = yield accountGenerator.generateDefaultAccount();
        yield accountsDatabase.addAccount(defaultAccount);
        accounts = { [defaultAccount.id]: defaultAccount };
        [accountIds, activeAccountId, accountNamesToAccountIds] = yield Promise.all([
            accountsDatabase.accountsMetadataDatabase.getItem('accountIds'),
            accountsDatabase.accountsMetadataDatabase.getItem('activeAccountId'),
            accountsDatabase.accountsMetadataDatabase.getItem('accountNamesToAccountIds'),
        ]);
        assert(accountIds && activeAccountId && accountNamesToAccountIds, `accountsStore error creating a default account during initialization accountsMetadataDatabase.accountIds '${accountIds}' accountsMetadataDatabase.activeAccountId '${activeAccountId}' accountsMetadataDatabase.accountNamesToAccountIds '${JSON.stringify(accountNamesToAccountIds)}'`);
    }
    const [accountsComments, accountsVotes, accountsCommentsReplies] = yield Promise.all([
        accountsDatabase.getAccountsComments(accountIds),
        accountsDatabase.getAccountsVotes(accountIds),
        accountsDatabase.getAccountsCommentsReplies(accountIds),
    ]);
    useAccountsStore.setState((state) => ({ accounts, accountIds, activeAccountId, accountNamesToAccountIds, accountsComments, accountsVotes, accountsCommentsReplies }));
    // start looking for updates for all accounts comments in database
    for (const accountId in accountsComments) {
        for (const accountComment of accountsComments[accountId]) {
            useAccountsStore
                .getState()
                .accountsActionsInternal.startUpdatingAccountCommentOnCommentUpdateEvents(accountComment, accounts[accountId], accountComment.index)
                .catch((error) => console.error('accountsStore.initializeAccountsStore startUpdatingAccountCommentOnCommentUpdateEvents error', {
                accountComment,
                accountCommentIndex: accountComment.index,
                accounts,
                error,
            }));
        }
    }
});
// TODO: find way to test started subplebbits
// poll all local subplebbits and start them if they are not started
let startSubplebbitsInterval;
let startedSubplebbits = {};
let pendingStartedSubplebbits = {};
const initializeStartSubplebbits = () => __awaiter(void 0, void 0, void 0, function* () {
    // if re-initializing, clear previous interval
    if (startSubplebbitsInterval) {
        clearInterval(startSubplebbitsInterval);
    }
    // if re-initializing, stop all started subplebbits
    for (const subplebbitAddress in startedSubplebbits) {
        try {
            yield startedSubplebbits[subplebbitAddress].stop();
        }
        catch (error) {
            console.error('accountsStore subplebbit.stop error', { subplebbitAddress, error });
        }
    }
    // don't start subplebbits twice
    startedSubplebbits = {};
    pendingStartedSubplebbits = {};
    const startSubplebbitsPollTime = 10000;
    startSubplebbitsInterval = setInterval(() => {
        const { accounts, activeAccountId } = useAccountsStore.getState();
        const account = activeAccountId && (accounts === null || accounts === void 0 ? void 0 : accounts[activeAccountId]);
        if (!(account === null || account === void 0 ? void 0 : account.plebbit)) {
            return;
        }
        account.plebbit.listSubplebbits().then((subplebbitAddresses) => __awaiter(void 0, void 0, void 0, function* () {
            for (const subplebbitAddress of subplebbitAddresses) {
                if (startedSubplebbits[subplebbitAddress] || pendingStartedSubplebbits[subplebbitAddress]) {
                    continue;
                }
                pendingStartedSubplebbits[subplebbitAddress] = true;
                try {
                    const subplebbit = yield account.plebbit.createSubplebbit({ address: subplebbitAddress });
                    yield subplebbit.start();
                    startedSubplebbits[subplebbitAddress] = subplebbit;
                }
                catch (error) {
                    console.error('accountsStore subplebbit.start error', { subplebbitAddress, error });
                }
                pendingStartedSubplebbits[subplebbitAddress] = false;
            }
        }));
    }, startSubplebbitsPollTime);
});
// @ts-ignore
const isInitializing = () => !!window.PLEBBIT_REACT_HOOKS_ACCOUNTS_STORE_INITIALIZING;
(() => __awaiter(void 0, void 0, void 0, function* () {
    // don't initialize on load multiple times when loading the file multiple times during karma tests
    // @ts-ignore
    if (window.PLEBBIT_REACT_HOOKS_ACCOUNTS_STORE_INITIALIZED_ONCE) {
        return;
    }
    // @ts-ignore
    window.PLEBBIT_REACT_HOOKS_ACCOUNTS_STORE_INITIALIZED_ONCE = true;
    // @ts-ignore
    window.PLEBBIT_REACT_HOOKS_ACCOUNTS_STORE_INITIALIZING = true;
    debug('accounts store initializing started');
    try {
        yield initializeAccountsStore();
    }
    catch (error) {
        // initializing can fail in tests when store is being reset at the same time as databases are being deleted
        console.error('accountsStore.initializeAccountsStore error', { accountsStore: useAccountsStore.getState(), error });
    }
    finally {
        // @ts-ignore
        delete window.PLEBBIT_REACT_HOOKS_ACCOUNTS_STORE_INITIALIZING;
    }
    debug('accounts store initializing finished');
    yield initializeStartSubplebbits();
}))();
// reset store in between tests
const originalState = useAccountsStore.getState();
// async function because some stores have async init
export const resetAccountsStore = () => __awaiter(void 0, void 0, void 0, function* () {
    // don't reset while initializing, it could happen during quick successive tests
    while (isInitializing()) {
        console.warn(`can't reset accounts store while initializing, waiting 100ms`);
        yield new Promise((r) => setTimeout(r, 100));
    }
    debug('accounts store reset started');
    // remove all event listeners
    listeners.forEach((listener) => listener.removeAllListeners());
    // destroy all component subscriptions to the store
    useAccountsStore.destroy();
    // restore original state
    useAccountsStore.setState(originalState);
    // init the store
    yield initializeAccountsStore();
    // init start subplebbits
    yield initializeStartSubplebbits();
    debug('accounts store reset finished');
});
// reset database and store in between tests
export const resetAccountsDatabaseAndStore = () => __awaiter(void 0, void 0, void 0, function* () {
    // don't reset while initializing, it could happen during quick successive tests
    while (isInitializing()) {
        console.warn(`can't reset accounts database while initializing, waiting 100ms`);
        yield new Promise((r) => setTimeout(r, 100));
    }
    yield Promise.all([localForage.createInstance({ name: 'accountsMetadata' }).clear(), localForage.createInstance({ name: 'accounts' }).clear()]);
    yield resetAccountsStore();
});
export default useAccountsStore;