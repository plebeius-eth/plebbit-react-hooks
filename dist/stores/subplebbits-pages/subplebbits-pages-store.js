var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import utils from '../../lib/utils';
import Debug from 'debug';
// include subplebbits pages store with feeds for debugging
const debug = Debug('plebbit-react-hooks:stores:feeds');
import accountsStore from '../accounts';
import localForageLru from '../../lib/localforage-lru';
import createStore from 'zustand';
import assert from 'assert';
const subplebbitsPagesDatabase = localForageLru.createInstance({ name: 'subplebbitsPages', size: 500 });
// reset all event listeners in between tests
export const listeners = [];
const subplebbitsPagesStore = createStore((setState, getState) => ({
    subplebbitsPages: {},
    addNextSubplebbitPageToStore: (subplebbit, sortType, account) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        assert((subplebbit === null || subplebbit === void 0 ? void 0 : subplebbit.address) && typeof (subplebbit === null || subplebbit === void 0 ? void 0 : subplebbit.address) === 'string', `subplebbitsPagesStore.addNextSubplebbitPageToStore subplebbit '${subplebbit}' invalid`);
        assert(sortType && typeof sortType === 'string', `subplebbitsPagesStore.addNextSubplebbitPageToStore sortType '${sortType}' invalid`);
        assert(typeof ((_a = account === null || account === void 0 ? void 0 : account.plebbit) === null || _a === void 0 ? void 0 : _a.createSubplebbit) === 'function', `subplebbitsPagesStore.addNextSubplebbitPageToStore account '${account}' invalid`);
        // check the preloaded posts on subplebbit.posts.pages first, then the subplebbits.posts.pageCids
        const subplebbitFirstPageCid = getSubplebbitFirstPageCid(subplebbit, sortType);
        assert(subplebbitFirstPageCid && typeof subplebbitFirstPageCid === 'string', `subplebbitsPagesStore.addNextSubplebbitPageToStore subplebbit.posts?.pageCids?.['${sortType}'] '${(_c = (_b = subplebbit.posts) === null || _b === void 0 ? void 0 : _b.pageCids) === null || _c === void 0 ? void 0 : _c[sortType]}' invalid`);
        // all subplebbits pages in store
        const { subplebbitsPages } = getState();
        // only specific pages of the subplebbit+sortType
        const subplebbitPages = getSubplebbitPages(subplebbit, sortType, subplebbitsPages);
        // if no pages exist yet, add the first page
        let pageCidToAdd;
        if (!subplebbitPages.length) {
            pageCidToAdd = subplebbitFirstPageCid;
        }
        else {
            const nextCid = (_d = subplebbitPages[subplebbitPages.length - 1]) === null || _d === void 0 ? void 0 : _d.nextCid;
            // if last nextCid is null, reached end of pages
            if (!nextCid) {
                debug('subplebbitsPagesStore.addNextSubplebbitPageToStore no more pages', { subplebbitAddress: subplebbit.address, sortType, account });
                return;
            }
            pageCidToAdd = nextCid;
        }
        // page is already added or pending
        if (subplebbitsPages[pageCidToAdd] || fetchPagePending[account.id + pageCidToAdd]) {
            return;
        }
        fetchPagePending[account.id + pageCidToAdd] = true;
        let page;
        try {
            page = yield fetchPage(pageCidToAdd, subplebbit.address, account);
            debug('subplebbitsPagesStore.addNextSubplebbitPageToStore subplebbit.posts.getPage', { pageCid: pageCidToAdd, subplebbitAddress: subplebbit.address, account });
            setState(({ subplebbitsPages }) => ({
                subplebbitsPages: Object.assign(Object.assign({}, subplebbitsPages), { [pageCidToAdd]: page }),
            }));
            debug('subplebbitsPagesStore.addNextSubplebbitPageToStore', { pageCid: pageCidToAdd, subplebbitAddress: subplebbit.address, sortType, page, account });
        }
        catch (e) {
            throw e;
        }
        finally {
            fetchPagePending[account.id + pageCidToAdd] = false;
        }
        // when publishing a comment, you don't yet know its CID
        // so when a new comment is fetched, check to see if it's your own
        // comment, and if yes, add the CID to your account comments database
        const flattenedReplies = utils.flattenCommentsPages(page);
        for (const comment of flattenedReplies) {
            accountsStore
                .getState()
                .accountsActionsInternal.addCidToAccountComment(comment)
                .catch((error) => console.error('subplebbitsPagesStore.addNextSubplebbitPageToStore addCidToAccountComment error', { comment, error }));
        }
    }),
}));
let fetchPagePending = {};
const fetchPage = (pageCid, subplebbitAddress, account) => __awaiter(void 0, void 0, void 0, function* () {
    // subplebbit page is cached
    const cachedSubplebbitPage = yield subplebbitsPagesDatabase.getItem(pageCid);
    if (cachedSubplebbitPage) {
        return cachedSubplebbitPage;
    }
    const subplebbit = yield account.plebbit.createSubplebbit({ address: subplebbitAddress });
    const fetchedSubplebbitPage = yield subplebbit.posts.getPage(pageCid);
    yield subplebbitsPagesDatabase.setItem(pageCid, fetchedSubplebbitPage);
    return fetchedSubplebbitPage;
});
/**
 * Util function to get all pages in the store for a
 * specific subplebbit+sortType using `SubplebbitPage.nextCid`
 */
export const getSubplebbitPages = (subplebbit, sortType, subplebbitsPages) => {
    var _a;
    assert(subplebbitsPages && typeof subplebbitsPages === 'object', `getSubplebbitPages subplebbitsPages '${subplebbitsPages}' invalid`);
    const pages = [];
    const firstPageCid = getSubplebbitFirstPageCid(subplebbit, sortType);
    // subplebbit has no pages
    // TODO: if a loaded subplebbit doesn't have a first page, it's unclear what we should do
    // should we try to use another sort type by default, like 'hot', or should we just ignore it?
    // 'return pages' to ignore it for now
    if (!firstPageCid) {
        return pages;
    }
    const firstPage = subplebbitsPages[firstPageCid];
    if (!firstPage) {
        return pages;
    }
    pages.push(firstPage);
    while (true) {
        const nextCid = (_a = pages[pages.length - 1]) === null || _a === void 0 ? void 0 : _a.nextCid;
        const subplebbitPage = nextCid && subplebbitsPages[nextCid];
        if (!subplebbitPage) {
            return pages;
        }
        pages.push(subplebbitPage);
    }
};
export const getSubplebbitFirstPageCid = (subplebbit, sortType) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    assert(subplebbit === null || subplebbit === void 0 ? void 0 : subplebbit.address, `getSubplebbitFirstPageCid subplebbit '${subplebbit}' invalid`);
    assert(sortType && typeof sortType === 'string', `getSubplebbitFirstPageCid sortType '${sortType}' invalid`);
    // subplebbit has preloaded posts for sort type
    if ((_c = (_b = (_a = subplebbit.posts) === null || _a === void 0 ? void 0 : _a.pages) === null || _b === void 0 ? void 0 : _b[sortType]) === null || _c === void 0 ? void 0 : _c.comments) {
        return (_f = (_e = (_d = subplebbit.posts) === null || _d === void 0 ? void 0 : _d.pages) === null || _e === void 0 ? void 0 : _e[sortType]) === null || _f === void 0 ? void 0 : _f.nextCid;
    }
    return (_h = (_g = subplebbit.posts) === null || _g === void 0 ? void 0 : _g.pageCids) === null || _h === void 0 ? void 0 : _h[sortType];
    // TODO: if a loaded subplebbit doesn't have a first page, it's unclear what we should do
    // should we try to use another sort type by default, like 'hot', or should we just ignore it?
};
// reset store in between tests
const originalState = subplebbitsPagesStore.getState();
// async function because some stores have async init
export const resetSubplebbitsPagesStore = () => __awaiter(void 0, void 0, void 0, function* () {
    fetchPagePending = {};
    // remove all event listeners
    listeners.forEach((listener) => listener.removeAllListeners());
    // destroy all component subscriptions to the store
    subplebbitsPagesStore.destroy();
    // restore original state
    subplebbitsPagesStore.setState(originalState);
});
// reset database and store in between tests
export const resetSubplebbitsPagesDatabaseAndStore = () => __awaiter(void 0, void 0, void 0, function* () {
    yield localForageLru.createInstance({ name: 'subplebbitsPages' }).clear();
    yield resetSubplebbitsPagesStore();
});
export default subplebbitsPagesStore;