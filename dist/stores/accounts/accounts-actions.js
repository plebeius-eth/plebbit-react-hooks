// public accounts actions that are called by the user
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import accountsStore, { listeners } from './accounts-store';
import subplebbitsStore from '../subplebbits';
import accountsDatabase from './accounts-database';
import accountGenerator from './account-generator';
import Debug from 'debug';
import validator from '../../lib/validator';
import assert from 'assert';
const debug = Debug('plebbit-react-hooks:stores:accounts');
import * as accountsActionsInternal from './accounts-actions-internal';
const addNewAccountToDatabaseAndState = (newAccount) => __awaiter(void 0, void 0, void 0, function* () {
    const { accounts, accountsComments, accountsVotes } = accountsStore.getState();
    yield accountsDatabase.addAccount(newAccount);
    const newAccounts = Object.assign(Object.assign({}, accounts), { [newAccount.id]: newAccount });
    const [newAccountIds, newAccountNamesToAccountIds] = yield Promise.all([
        accountsDatabase.accountsMetadataDatabase.getItem('accountIds'),
        accountsDatabase.accountsMetadataDatabase.getItem('accountNamesToAccountIds'),
    ]);
    const newState = {
        accounts: newAccounts,
        accountIds: newAccountIds,
        accountNamesToAccountIds: newAccountNamesToAccountIds,
        accountsComments: Object.assign(Object.assign({}, accountsComments), { [newAccount.id]: [] }),
        accountsVotes: Object.assign(Object.assign({}, accountsVotes), { [newAccount.id]: {} }),
    };
    // if there is only 1 account, make it active
    // otherwise stay on the same active account
    if (newAccountIds.length === 1) {
        newState.activeAccountId = newAccount.id;
    }
    accountsStore.setState(newState);
});
export const createAccount = (accountName) => __awaiter(void 0, void 0, void 0, function* () {
    const newAccount = yield accountGenerator.generateDefaultAccount();
    if (accountName) {
        newAccount.name = accountName;
    }
    yield addNewAccountToDatabaseAndState(newAccount);
    debug('accountsActions.createAccount', { accountName, account: newAccount });
});
export const deleteAccount = (accountName) => __awaiter(void 0, void 0, void 0, function* () {
    const { accounts, accountNamesToAccountIds, activeAccountId, accountsComments, accountsVotes } = accountsStore.getState();
    assert(accounts && accountNamesToAccountIds && activeAccountId, `can't use accountsStore.accountActions before initialized`);
    let account = accounts[activeAccountId];
    if (accountName) {
        const accountId = accountNamesToAccountIds[accountName];
        account = accounts[accountId];
    }
    assert(account === null || account === void 0 ? void 0 : account.id, `accountsActions.deleteAccount account.id '${account === null || account === void 0 ? void 0 : account.id}' doesn't exist, activeAccountId '${activeAccountId}' accountName '${accountName}'`);
    yield accountsDatabase.removeAccount(account);
    const newAccounts = Object.assign({}, accounts);
    delete newAccounts[account.id];
    const [newAccountIds, newActiveAccountId, newAccountNamesToAccountIds] = yield Promise.all([
        accountsDatabase.accountsMetadataDatabase.getItem('accountIds'),
        accountsDatabase.accountsMetadataDatabase.getItem('activeAccountId'),
        accountsDatabase.accountsMetadataDatabase.getItem('accountNamesToAccountIds'),
    ]);
    const newAccountsComments = Object.assign({}, accountsComments);
    delete newAccountsComments[account.id];
    const newAccountsVotes = Object.assign({}, accountsVotes);
    delete newAccountsVotes[account.id];
    accountsStore.setState({
        accounts: newAccounts,
        accountIds: newAccountIds,
        activeAccountId: newActiveAccountId,
        accountNamesToAccountIds: newAccountNamesToAccountIds,
        accountsComments: newAccountsComments,
        accountsVotes: newAccountsVotes,
    });
});
export const setActiveAccount = (accountName) => __awaiter(void 0, void 0, void 0, function* () {
    const { accountNamesToAccountIds } = accountsStore.getState();
    assert(accountNamesToAccountIds, `can't use accountsStore.accountActions before initialized`);
    validator.validateAccountsActionsSetActiveAccountArguments(accountName);
    const accountId = accountNamesToAccountIds[accountName];
    yield accountsDatabase.accountsMetadataDatabase.setItem('activeAccountId', accountId);
    debug('accountsActions.setActiveAccount', { accountName, accountId });
    accountsStore.setState({ activeAccountId: accountId });
});
export const setAccount = (account) => __awaiter(void 0, void 0, void 0, function* () {
    const { accounts } = accountsStore.getState();
    validator.validateAccountsActionsSetAccountArguments(account);
    assert(accounts === null || accounts === void 0 ? void 0 : accounts[account.id], `cannot set account with account.id '${account.id}' id does not exist in database`);
    // use this function to serialize and update all databases
    yield accountsDatabase.addAccount(account);
    const [newAccount, newAccountNamesToAccountIds] = yield Promise.all([
        // use this function to deserialize
        accountsDatabase.getAccount(account.id),
        accountsDatabase.accountsMetadataDatabase.getItem('accountNamesToAccountIds'),
    ]);
    const newAccounts = Object.assign(Object.assign({}, accounts), { [newAccount.id]: newAccount });
    debug('accountsActions.setAccount', { account: newAccount });
    accountsStore.setState({ accounts: newAccounts, accountNamesToAccountIds: newAccountNamesToAccountIds });
});
export const setAccountsOrder = (newOrderedAccountNames) => __awaiter(void 0, void 0, void 0, function* () {
    const { accounts, accountNamesToAccountIds } = accountsStore.getState();
    assert(accounts && accountNamesToAccountIds, `can't use accountsStore.accountActions before initialized`);
    const accountIds = [];
    const accountNames = [];
    for (const accountName of newOrderedAccountNames) {
        const accountId = accountNamesToAccountIds[accountName];
        accountIds.push(accountId);
        accountNames.push(accounts[accountId].name);
    }
    validator.validateAccountsActionsSetAccountsOrderArguments(newOrderedAccountNames, accountNames);
    debug('accountsActions.setAccountsOrder', {
        previousAccountNames: accountNames,
        newAccountNames: newOrderedAccountNames,
    });
    yield accountsDatabase.accountsMetadataDatabase.setItem('accountIds', accountIds);
    accountsStore.setState({ accountIds });
});
export const importAccount = (serializedAccount) => __awaiter(void 0, void 0, void 0, function* () {
    const { accounts, accountNamesToAccountIds, activeAccountId } = accountsStore.getState();
    assert(accounts && accountNamesToAccountIds && activeAccountId, `can't use accountsStore.accountActions before initialized`);
    let account;
    try {
        account = JSON.parse(serializedAccount);
    }
    catch (e) { }
    assert(account && (account === null || account === void 0 ? void 0 : account.id) && (account === null || account === void 0 ? void 0 : account.name), `accountsActions.importAccount failed JSON.stringify json serializedAccount '${serializedAccount}'`);
    // if account.name already exists, add ' 2', don't overwrite
    if (accountNamesToAccountIds[account.name]) {
        account.name += ' 2';
    }
    // create a new account id
    const { id } = yield accountGenerator.generateDefaultAccount();
    const newAccount = Object.assign(Object.assign({}, account), { id });
    yield addNewAccountToDatabaseAndState(newAccount);
    debug('accountsActions.importAccount', { account: newAccount });
    // TODO: the 'account' should contain AccountComments and AccountVotes
    // TODO: add options to only import private key, account settings, or include all account comments/votes history
});
export const exportAccount = (accountName) => __awaiter(void 0, void 0, void 0, function* () {
    const { accounts, accountNamesToAccountIds, activeAccountId } = accountsStore.getState();
    assert(accounts && accountNamesToAccountIds && activeAccountId, `can't use accountsStore.accountActions before initialized`);
    let account = accounts[activeAccountId];
    if (accountName) {
        const accountId = accountNamesToAccountIds[accountName];
        account = accounts[accountId];
    }
    assert(account === null || account === void 0 ? void 0 : account.id, `accountsActions.exportAccount account.id '${account === null || account === void 0 ? void 0 : account.id}' doesn't exist, activeAccountId '${activeAccountId}' accountName '${accountName}'`);
    const accountJson = yield accountsDatabase.getAccountJson(account.id);
    debug('accountsActions.exportAccount', { accountJson });
    return accountJson;
    // TODO: the 'account' should contain AccountComments and AccountVotes
    // TODO: add options to only export private key, account settings, or include all account comments/votes history
});
export const subscribe = (subplebbitAddress, accountName) => __awaiter(void 0, void 0, void 0, function* () {
    const { accounts, accountNamesToAccountIds, activeAccountId } = accountsStore.getState();
    assert(subplebbitAddress && typeof subplebbitAddress === 'string', `accountsActions.subscribe invalid subplebbitAddress '${subplebbitAddress}'`);
    assert(accounts && accountNamesToAccountIds && activeAccountId, `can't use accountsStore.accountActions before initialized`);
    let account = accounts[activeAccountId];
    if (accountName) {
        const accountId = accountNamesToAccountIds[accountName];
        account = accounts[accountId];
    }
    assert(account === null || account === void 0 ? void 0 : account.id, `accountsActions.subscribe account.id '${account === null || account === void 0 ? void 0 : account.id}' doesn't exist, activeAccountId '${activeAccountId}' accountName '${accountName}'`);
    const subscriptions = account.subscriptions || [];
    if (subscriptions.includes(subplebbitAddress)) {
        throw Error(`account '${account.id}' already subscribed to '${subplebbitAddress}'`);
    }
    subscriptions.push(subplebbitAddress);
    const updatedAccount = Object.assign(Object.assign({}, account), { subscriptions });
    // update account in db
    yield accountsDatabase.addAccount(updatedAccount);
    const updatedAccounts = Object.assign(Object.assign({}, accounts), { [updatedAccount.id]: updatedAccount });
    debug('accountsActions.subscribe', { account: updatedAccount, accountName, subplebbitAddress });
    accountsStore.setState({ accounts: updatedAccounts });
});
export const unsubscribe = (subplebbitAddress, accountName) => __awaiter(void 0, void 0, void 0, function* () {
    const { accounts, accountNamesToAccountIds, activeAccountId } = accountsStore.getState();
    assert(subplebbitAddress && typeof subplebbitAddress === 'string', `accountsActions.unsubscribe invalid subplebbitAddress '${subplebbitAddress}'`);
    assert(accounts && accountNamesToAccountIds && activeAccountId, `can't use accountsStore.accountActions before initialized`);
    let account = accounts[activeAccountId];
    if (accountName) {
        const accountId = accountNamesToAccountIds[accountName];
        account = accounts[accountId];
    }
    assert(account === null || account === void 0 ? void 0 : account.id, `accountsActions.unsubscribe account.id '${account === null || account === void 0 ? void 0 : account.id}' doesn't exist, activeAccountId '${activeAccountId}' accountName '${accountName}'`);
    let subscriptions = account.subscriptions || [];
    if (!subscriptions.includes(subplebbitAddress)) {
        throw Error(`account '${account.id}' already unsubscribed from '${subplebbitAddress}'`);
    }
    // remove subplebbitAddress
    subscriptions = subscriptions.filter((address) => address !== subplebbitAddress);
    const updatedAccount = Object.assign(Object.assign({}, account), { subscriptions });
    // update account in db
    yield accountsDatabase.addAccount(updatedAccount);
    const updatedAccounts = Object.assign(Object.assign({}, accounts), { [updatedAccount.id]: updatedAccount });
    debug('accountsActions.unsubscribe', { account: updatedAccount, accountName, subplebbitAddress });
    accountsStore.setState({ accounts: updatedAccounts });
});
export const blockAddress = (address, accountName) => __awaiter(void 0, void 0, void 0, function* () {
    const { accounts, accountNamesToAccountIds, activeAccountId } = accountsStore.getState();
    assert(address && typeof address === 'string', `accountsActions.blockAddress invalid address '${address}'`);
    assert(accounts && accountNamesToAccountIds && activeAccountId, `can't use accountsStore.accountActions before initialized`);
    let account = accounts[activeAccountId];
    if (accountName) {
        const accountId = accountNamesToAccountIds[accountName];
        account = accounts[accountId];
    }
    assert(account === null || account === void 0 ? void 0 : account.id, `accountsActions.blockAddress account.id '${account === null || account === void 0 ? void 0 : account.id}' doesn't exist, activeAccountId '${activeAccountId}' accountName '${accountName}'`);
    const blockedAddresses = Object.assign({}, account.blockedAddresses);
    if (blockedAddresses[address] === true) {
        throw Error(`account '${account.id}' already blocked address '${address}'`);
    }
    blockedAddresses[address] = true;
    const updatedAccount = Object.assign(Object.assign({}, account), { blockedAddresses });
    // update account in db
    yield accountsDatabase.addAccount(updatedAccount);
    const updatedAccounts = Object.assign(Object.assign({}, accounts), { [updatedAccount.id]: updatedAccount });
    debug('accountsActions.blockAddress', { account: updatedAccount, accountName, address });
    accountsStore.setState({ accounts: updatedAccounts });
});
export const unblockAddress = (address, accountName) => __awaiter(void 0, void 0, void 0, function* () {
    const { accounts, accountNamesToAccountIds, activeAccountId } = accountsStore.getState();
    assert(address && typeof address === 'string', `accountsActions.unblockAddress invalid address '${address}'`);
    assert(accounts && accountNamesToAccountIds && activeAccountId, `can't use accountsStore.accountActions before initialized`);
    let account = accounts[activeAccountId];
    if (accountName) {
        const accountId = accountNamesToAccountIds[accountName];
        account = accounts[accountId];
    }
    assert(account === null || account === void 0 ? void 0 : account.id, `accountsActions.unblockAddress account.id '${account === null || account === void 0 ? void 0 : account.id}' doesn't exist, activeAccountId '${activeAccountId}' accountName '${accountName}'`);
    const blockedAddresses = Object.assign({}, account.blockedAddresses);
    if (!blockedAddresses[address]) {
        throw Error(`account '${account.id}' already blocked address '${address}'`);
    }
    delete blockedAddresses[address];
    const updatedAccount = Object.assign(Object.assign({}, account), { blockedAddresses });
    // update account in db
    yield accountsDatabase.addAccount(updatedAccount);
    const updatedAccounts = Object.assign(Object.assign({}, accounts), { [updatedAccount.id]: updatedAccount });
    debug('accountsActions.unblockAddress', { account: updatedAccount, accountName, address });
    accountsStore.setState({ accounts: updatedAccounts });
});
export const publishComment = (publishCommentOptions, accountName) => __awaiter(void 0, void 0, void 0, function* () {
    const { accounts, accountNamesToAccountIds, activeAccountId } = accountsStore.getState();
    assert(accounts && accountNamesToAccountIds && activeAccountId, `can't use accountsStore.accountActions before initialized`);
    let account = accounts[activeAccountId];
    if (accountName) {
        const accountId = accountNamesToAccountIds[accountName];
        account = accounts[accountId];
    }
    validator.validateAccountsActionsPublishCommentArguments({ publishCommentOptions, accountName, account });
    let createCommentOptions = Object.assign({ timestamp: Math.round(Date.now() / 1000), author: account.author, signer: account.signer }, publishCommentOptions);
    delete createCommentOptions.onChallenge;
    delete createCommentOptions.onChallengeVerification;
    let accountCommentIndex;
    let comment = yield account.plebbit.createComment(createCommentOptions);
    const publishAndRetryFailedChallengeVerification = () => {
        comment.once('challenge', (challenge) => __awaiter(void 0, void 0, void 0, function* () {
            publishCommentOptions.onChallenge(challenge, comment);
        }));
        comment.once('challengeverification', (challengeVerification) => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            publishCommentOptions.onChallengeVerification(challengeVerification, comment);
            if (!challengeVerification.challengeSuccess) {
                // publish again automatically on fail
                createCommentOptions = Object.assign(Object.assign({}, createCommentOptions), { timestamp: Math.round(Date.now() / 1000) });
                comment = yield account.plebbit.createComment(createCommentOptions);
                publishAndRetryFailedChallengeVerification();
            }
            else {
                // the challengeverification message of a comment publication should in theory send back the CID
                // of the published comment which is needed to resolve it for replies, upvotes, etc
                if ((_a = challengeVerification === null || challengeVerification === void 0 ? void 0 : challengeVerification.publication) === null || _a === void 0 ? void 0 : _a.cid) {
                    const commentWithCid = Object.assign(Object.assign({}, createCommentOptions), { cid: challengeVerification.publication.cid });
                    yield accountsDatabase.addAccountComment(account.id, commentWithCid, accountCommentIndex);
                    accountsStore.setState(({ accountsComments }) => {
                        const updatedAccountComments = [...accountsComments[account.id]];
                        const updatedAccountComment = Object.assign(Object.assign({}, commentWithCid), { index: accountCommentIndex, accountId: account.id });
                        updatedAccountComments[accountCommentIndex] = updatedAccountComment;
                        return { accountsComments: Object.assign(Object.assign({}, accountsComments), { [account.id]: updatedAccountComments }) };
                    });
                    accountsActionsInternal
                        .startUpdatingAccountCommentOnCommentUpdateEvents(comment, account, accountCommentIndex)
                        .catch((error) => console.error('accountsActions.publishComment startUpdatingAccountCommentOnCommentUpdateEvents error', { comment, account, accountCommentIndex, error }));
                }
            }
        }));
        listeners.push(comment);
        comment.publish();
    };
    publishAndRetryFailedChallengeVerification();
    yield accountsDatabase.addAccountComment(account.id, createCommentOptions);
    debug('accountsActions.publishComment', { createCommentOptions });
    accountsStore.setState(({ accountsComments }) => {
        // save account comment index to update the comment later
        accountCommentIndex = accountsComments[account.id].length;
        const createdAccountComment = Object.assign(Object.assign({}, createCommentOptions), { index: accountCommentIndex, accountId: account.id });
        return {
            accountsComments: Object.assign(Object.assign({}, accountsComments), { [account.id]: [...accountsComments[account.id], createdAccountComment] }),
        };
    });
});
export const deleteComment = (commentCidOrAccountCommentIndex, accountName) => __awaiter(void 0, void 0, void 0, function* () {
    throw Error('TODO: not implemented');
});
export const publishVote = (publishVoteOptions, accountName) => __awaiter(void 0, void 0, void 0, function* () {
    const { accounts, accountNamesToAccountIds, activeAccountId } = accountsStore.getState();
    assert(accounts && accountNamesToAccountIds && activeAccountId, `can't use accountsStore.accountActions before initialized`);
    let account = accounts[activeAccountId];
    if (accountName) {
        const accountId = accountNamesToAccountIds[accountName];
        account = accounts[accountId];
    }
    validator.validateAccountsActionsPublishVoteArguments({ publishVoteOptions, accountName, account });
    let createVoteOptions = Object.assign({ timestamp: Math.round(Date.now() / 1000), author: account.author, signer: account.signer }, publishVoteOptions);
    delete createVoteOptions.onChallenge;
    delete createVoteOptions.onChallengeVerification;
    let vote = yield account.plebbit.createVote(createVoteOptions);
    const publishAndRetryFailedChallengeVerification = () => {
        vote.once('challenge', (challenge) => __awaiter(void 0, void 0, void 0, function* () {
            publishVoteOptions.onChallenge(challenge, vote);
        }));
        vote.once('challengeverification', (challengeVerification) => __awaiter(void 0, void 0, void 0, function* () {
            publishVoteOptions.onChallengeVerification(challengeVerification, vote);
            if (!challengeVerification.challengeSuccess) {
                // publish again automatically on fail
                createVoteOptions = Object.assign(Object.assign({}, createVoteOptions), { timestamp: Math.round(Date.now() / 1000) });
                vote = yield account.plebbit.createVote(createVoteOptions);
                publishAndRetryFailedChallengeVerification();
            }
        }));
        listeners.push(vote);
        vote.publish();
    };
    publishAndRetryFailedChallengeVerification();
    yield accountsDatabase.addAccountVote(account.id, createVoteOptions);
    debug('accountsActions.publishVote', { createVoteOptions });
    accountsStore.setState(({ accountsVotes }) => ({
        accountsVotes: Object.assign(Object.assign({}, accountsVotes), { [account.id]: Object.assign(Object.assign({}, accountsVotes[account.id]), { [createVoteOptions.commentCid]: createVoteOptions }) }),
    }));
});
export const publishCommentEdit = (publishCommentEditOptions, accountName) => __awaiter(void 0, void 0, void 0, function* () {
    const { accounts, accountNamesToAccountIds, activeAccountId } = accountsStore.getState();
    assert(accounts && accountNamesToAccountIds && activeAccountId, `can't use accountsStore.accountActions before initialized`);
    let account = accounts[activeAccountId];
    if (accountName) {
        const accountId = accountNamesToAccountIds[accountName];
        account = accounts[accountId];
    }
    validator.validateAccountsActionsPublishCommentEditArguments({ publishCommentEditOptions, accountName, account });
    let createCommentEditOptions = Object.assign({ timestamp: Math.round(Date.now() / 1000), author: account.author, signer: account.signer }, publishCommentEditOptions);
    delete createCommentEditOptions.onChallenge;
    delete createCommentEditOptions.onChallengeVerification;
    let commentEdit = yield account.plebbit.createCommentEdit(createCommentEditOptions);
    const publishAndRetryFailedChallengeVerification = () => {
        commentEdit.once('challenge', (challenge) => __awaiter(void 0, void 0, void 0, function* () {
            publishCommentEditOptions.onChallenge(challenge, commentEdit);
        }));
        commentEdit.once('challengeverification', (challengeVerification) => __awaiter(void 0, void 0, void 0, function* () {
            publishCommentEditOptions.onChallengeVerification(challengeVerification, commentEdit);
            if (!challengeVerification.challengeSuccess) {
                // publish again automatically on fail
                createCommentEditOptions = Object.assign(Object.assign({}, createCommentEditOptions), { timestamp: Math.round(Date.now() / 1000) });
                commentEdit = yield account.plebbit.createCommentEdit(createCommentEditOptions);
                publishAndRetryFailedChallengeVerification();
            }
        }));
        listeners.push(commentEdit);
        commentEdit.publish();
    };
    publishAndRetryFailedChallengeVerification();
    debug('accountsActions.publishCommentEdit', { createCommentEditOptions });
    // TODO: show pending edits somewhere
});
export const publishSubplebbitEdit = (subplebbitAddress, publishSubplebbitEditOptions, accountName) => __awaiter(void 0, void 0, void 0, function* () {
    const { accounts, accountNamesToAccountIds, activeAccountId } = accountsStore.getState();
    assert(accounts && accountNamesToAccountIds && activeAccountId, `can't use accountsStore.accountActions before initialized`);
    let account = accounts[activeAccountId];
    if (accountName) {
        const accountId = accountNamesToAccountIds[accountName];
        account = accounts[accountId];
    }
    validator.validateAccountsActionsPublishSubplebbitEditArguments({ subplebbitAddress, publishSubplebbitEditOptions, accountName, account });
    // account is the owner of the subplebbit and can edit it locally, no need to publish
    const localSubplebbitAddresses = yield account.plebbit.listSubplebbits();
    if (localSubplebbitAddresses.includes(subplebbitAddress)) {
        yield subplebbitsStore.getState().editSubplebbit(subplebbitAddress, publishSubplebbitEditOptions, account);
        // create fake success challenge verification for consistent behavior with remote subplebbit edit
        publishSubplebbitEditOptions.onChallengeVerification({ challengeSuccess: true });
        return;
    }
    assert(!publishSubplebbitEditOptions.address || publishSubplebbitEditOptions.address === subplebbitAddress, `accountsActions.publishSubplebbitEdit can't edit address of a remote subplebbit`);
    let createSubplebbitEditOptions = Object.assign(Object.assign({ timestamp: Math.round(Date.now() / 1000), author: account.author, signer: account.signer }, publishSubplebbitEditOptions), { 
        // not possible to edit subplebbit.address over pubsub, only locally
        address: subplebbitAddress });
    delete createSubplebbitEditOptions.onChallenge;
    delete createSubplebbitEditOptions.onChallengeVerification;
    let subplebbitEdit = yield account.plebbit.createSubplebbitEdit(createSubplebbitEditOptions);
    const publishAndRetryFailedChallengeVerification = () => {
        subplebbitEdit.once('challenge', (challenge) => __awaiter(void 0, void 0, void 0, function* () {
            publishSubplebbitEditOptions.onChallenge(challenge, subplebbitEdit);
        }));
        subplebbitEdit.once('challengeverification', (challengeVerification) => __awaiter(void 0, void 0, void 0, function* () {
            publishSubplebbitEditOptions.onChallengeVerification(challengeVerification, subplebbitEdit);
            if (!challengeVerification.challengeSuccess) {
                // publish again automatically on fail
                createSubplebbitEditOptions = Object.assign(Object.assign({}, createSubplebbitEditOptions), { timestamp: Math.round(Date.now() / 1000) });
                subplebbitEdit = yield account.plebbit.createSubplebbitEdit(createSubplebbitEditOptions);
                publishAndRetryFailedChallengeVerification();
            }
        }));
        listeners.push(subplebbitEdit);
        subplebbitEdit.publish();
    };
    publishAndRetryFailedChallengeVerification();
    debug('accountsActions.publishSubplebbitEdit', { createSubplebbitEditOptions });
});
export const createSubplebbit = (createSubplebbitOptions, accountName) => __awaiter(void 0, void 0, void 0, function* () {
    const { accounts, accountNamesToAccountIds, activeAccountId } = accountsStore.getState();
    assert(accounts && accountNamesToAccountIds && activeAccountId, `can't use accountsStore.accountsActions before initialized`);
    let account = accounts[activeAccountId];
    if (accountName) {
        const accountId = accountNamesToAccountIds[accountName];
        account = accounts[accountId];
    }
    const subplebbit = yield subplebbitsStore.getState().createSubplebbit(createSubplebbitOptions, account);
    debug('accountsActions.createSubplebbit', { createSubplebbitOptions, subplebbit });
    return subplebbit;
});
