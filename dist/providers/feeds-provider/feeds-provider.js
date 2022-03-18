var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import React, { useState, useEffect, useContext, useMemo } from 'react';
import { AccountsContext } from '../accounts-provider';
import { SubplebbitsContext } from '../subplebbits-provider';
import feedSorter from './feed-sorter';
import assert from 'assert';
import localForageLru from '../../lib/localforage-lru';
import utils from '../../lib/utils';
import Debug from 'debug';
const debug = Debug('plebbitreacthooks:providers:feedsprovider');
const sortedPostsDatabase = localForageLru.createInstance({ name: 'sortedPosts', size: 500 });
// reddit loads approximately 25 posts per page
// while infinite scrolling
const postsPerPage = 25;
// keep large buffer because fetching cids is slow
const subplebbitPostsLeftBeforeNextPage = 50;
export const FeedsContext = React.createContext(undefined);
export default function FeedsProvider(props) {
    const [feedsOptions, setFeedsOptions] = useState({});
    const [bufferedFeeds, setBufferedFeeds] = useState({});
    const [loadedFeeds, setLoadedFeeds] = useState({});
    // fetch subplebbits, sorted posts and next pages whenever bufferedFeeds gets too low
    const subplebbits = useSubplebbits(feedsOptions);
    const feedsSortedPostsInfo = useFeedsSortedPostsInfo(feedsOptions, subplebbits, bufferedFeeds);
    const sortedPostsPages = useSortedPostsPages(feedsSortedPostsInfo, subplebbits);
    const calculatedBufferedFeeds = useCalculatedBufferedFeeds(feedsOptions, feedsSortedPostsInfo, sortedPostsPages, loadedFeeds);
    const feedsHaveMore = useFeedsHaveMore(feedsOptions, subplebbits, sortedPostsPages, bufferedFeeds);
    // handle buffered feeds
    useEffect(() => {
        // don't rerender if there are no feeds
        if (Object.keys(calculatedBufferedFeeds).length === 0) {
            return;
        }
        setBufferedFeeds(calculatedBufferedFeeds);
    }, [calculatedBufferedFeeds]);
    // handle loaded feeds
    useEffect(() => {
        const loadedFeedsMissingPosts = {};
        for (const feedName in feedsOptions) {
            const { pageNumber } = feedsOptions[feedName];
            const loadedFeedPostCount = pageNumber * postsPerPage;
            const currentLoadedFeed = loadedFeeds[feedName] || [];
            const missingPostsCount = loadedFeedPostCount - currentLoadedFeed.length;
            // get new posts from buffered feed
            const bufferedFeed = bufferedFeeds[feedName] || [];
            const missingPosts = [...bufferedFeed];
            if (missingPosts.length > missingPostsCount) {
                missingPosts.length = missingPostsCount;
            }
            // the current loaded feed already exist and doesn't need new posts
            if (missingPosts.length === 0 && loadedFeeds[feedName]) {
                continue;
            }
            loadedFeedsMissingPosts[feedName] = missingPosts;
        }
        // don't rerender if there are no missing posts
        if (Object.keys(loadedFeedsMissingPosts).length === 0) {
            return;
        }
        setLoadedFeeds(previousLoadedFeeds => {
            const newLoadedFeeds = {};
            for (const feedName in loadedFeedsMissingPosts) {
                newLoadedFeeds[feedName] = [...previousLoadedFeeds[feedName] || [], ...loadedFeedsMissingPosts[feedName]];
            }
            return Object.assign(Object.assign({}, previousLoadedFeeds), newLoadedFeeds);
        });
    }, [bufferedFeeds, feedsOptions]);
    const feedsActions = {};
    feedsActions.addFeedToContext = (feedName, subplebbitAddresses, sortType, account, isBufferedFeed) => {
        // feed is in context already, do nothing
        // if the feed already exist but is at page 1, reset it to page 1
        if (feedsOptions[feedName] && feedsOptions[feedName].pageNumber !== 0) {
            return;
        }
        // to add a buffered feed, add a feed with pageNumber 0
        const feedOptions = { subplebbitAddresses, sortType, account, pageNumber: isBufferedFeed === true ? 0 : 1 };
        debug('feedsActions.addFeedToContext', feedOptions);
        setFeedsOptions(previousFeedsOptions => {
            // make sure to never overwrite a feed already added
            if (previousFeedsOptions[feedName]) {
                return previousFeedsOptions;
            }
            return Object.assign(Object.assign({}, previousFeedsOptions), { [feedName]: feedOptions });
        });
    };
    feedsActions.incrementFeedPageNumber = (feedName) => {
        assert(feedsOptions[feedName], `feedsActions.incrementFeedPageNumber feed name '${feedName}' does not exist in FeedsContext`);
        // assert(feedsOptions[feedName].pageNumber * postsPerPage <= loadedFeeds[feedName].length, `feedsActions.incrementFeedPageNumber cannot increment feed page number before current page has loaded`)
        debug('feedsActions.incrementFeedPageNumber', { feedName });
        setFeedsOptions(previousFeedsOptions => {
            assert(previousFeedsOptions[feedName].pageNumber * postsPerPage <= loadedFeeds[feedName].length, `feedsActions.incrementFeedPageNumber cannot increment feed page number before current page has loaded`);
            const feedOptions = Object.assign(Object.assign({}, previousFeedsOptions[feedName]), { pageNumber: previousFeedsOptions[feedName].pageNumber + 1 });
            return Object.assign(Object.assign({}, previousFeedsOptions), { [feedName]: feedOptions });
        });
    };
    if (!props.children) {
        return null;
    }
    const feedsContext = {
        bufferedFeeds,
        loadedFeeds,
        feedsActions,
        feedsHaveMore
    };
    // debug util
    const bufferedFeedsLengths = useFeedsLengths(bufferedFeeds);
    const loadedFeedsLengths = useFeedsLengths(loadedFeeds);
    debug({ feedsOptions, feedsHaveMore, feedsSortedPostsInfo, sortedPostsPages, bufferedFeedsLengths, loadedFeedsLengths });
    return React.createElement(FeedsContext.Provider, { value: feedsContext }, props.children);
}
/**
 * Debug util
 */
function useFeedsLengths(feeds) {
    return useMemo(() => {
        const feedsLengths = {};
        for (const feedName in feeds) {
            if (feeds[feedName]) {
                feedsLengths[feedName] = feeds[feedName].length || 0;
            }
        }
        return feedsLengths;
    }, [feeds]);
}
/**
 * Generate a list of `feedSortedPostsInfo` objects which contain the information required
 * to initiate fetching the pages of each subplebbit/sort/account/feed
 */
function useFeedsHaveMore(feedsOptions, subplebbits, sortedPostsPages, bufferedFeeds) {
    return useMemo(() => {
        var _a, _b;
        const feedsHaveMore = {};
        feedsLoop: for (const feedName in feedsOptions) {
            // if the feed still has buffered posts, then it still has more
            if ((_a = bufferedFeeds[feedName]) === null || _a === void 0 ? void 0 : _a.length) {
                feedsHaveMore[feedName] = true;
                continue;
            }
            const { subplebbitAddresses, sortType } = feedsOptions[feedName];
            for (const subplebbitAddress of subplebbitAddresses) {
                const subplebbit = subplebbits[subplebbitAddress];
                // if at least 1 subplebbit hasn't loaded yet, then the feed still has more
                if (!subplebbit) {
                    feedsHaveMore[feedName] = true;
                    continue feedsLoop;
                }
                const firstPageSortedPostsCid = (_b = subplebbit.sortedPostsCids) === null || _b === void 0 ? void 0 : _b[sortType];
                // TODO: if a loaded subplebbit doesn't have a first page, it's unclear what we should do
                // should we try to use another sort type by default, like 'hot', or should we just ignore it?
                // 'continue' to ignore it for now
                if (!firstPageSortedPostsCid) {
                    continue;
                }
                const pages = getSubplebbitSortedPostsPages(firstPageSortedPostsCid, sortedPostsPages);
                // if first page isn't loaded yet, then the feed still has more
                if (!pages.length) {
                    feedsHaveMore[feedName] = true;
                    continue feedsLoop;
                }
                const lastPage = pages[pages.length - 1];
                if (lastPage.nextSortedCommentsCid) {
                    feedsHaveMore[feedName] = true;
                    continue feedsLoop;
                }
            }
            // if buffered feeds are empty and no last page of any subplebbit has a next page, then has more is false
            feedsHaveMore[feedName] = false;
        }
        return feedsHaveMore;
    }, [feedsOptions, bufferedFeeds, subplebbits, sortedPostsPages]);
}
/**
 * Calculate the final buffered feeds from all the loaded sorted posts pages, sort them,
 * and remove the posts already loaded in loadedFeeds
 */
function useCalculatedBufferedFeeds(feedsOptions, feedsSortedPostsInfo, sortedPostsPages, loadedFeeds) {
    return useMemo(() => {
        // contruct a list of posts already loaded to remove them from buffered feeds
        const loadedFeedsPosts = {};
        for (const feedName in loadedFeeds) {
            loadedFeedsPosts[feedName] = new Set();
            for (const post of loadedFeeds[feedName]) {
                loadedFeedsPosts[feedName].add(post.cid);
            }
        }
        // calculate each feed
        let newBufferedFeeds = {};
        for (const feedName in feedsOptions) {
            const { subplebbitAddresses, sortType, account } = feedsOptions[feedName];
            // find all fetched posts
            const bufferedFeedPosts = [];
            // start by finding all sortedPostsCids
            for (const subplebbitAddress of subplebbitAddresses) {
                for (const infoName in feedsSortedPostsInfo) {
                    const info = feedsSortedPostsInfo[infoName];
                    if (info.sortType !== sortType) {
                        continue;
                    }
                    if (info.subplebbitAddress !== subplebbitAddress) {
                        continue;
                    }
                    // found an info that matches the sub address and sorted by
                    // get all the pages for it from sortedPostsPages
                    const subplebbitSortedPostsPages = getSubplebbitSortedPostsPages(info.firstPageSortedPostsCid, sortedPostsPages);
                    // add each comment from each page, do not filter at this stage, filter after sorting
                    for (const sortedPostsPage of subplebbitSortedPostsPages) {
                        if (sortedPostsPage === null || sortedPostsPage === void 0 ? void 0 : sortedPostsPage.comments) {
                            bufferedFeedPosts.push(...sortedPostsPage.comments);
                        }
                    }
                }
            }
            // sort the feed before filtering to get more accurate results
            const sortedBufferedFeedPosts = feedSorter.sort(sortType, bufferedFeedPosts);
            // filter the feed
            const filteredSortedBufferedFeedPosts = [];
            for (const post of sortedBufferedFeedPosts) {
                // don't add posts already loaded in loaded feeds
                if (loadedFeedsPosts[feedName].has(post.cid)) {
                    continue;
                }
                // TODO: filter blocked addresses
                // if (account.blockedAddresses[post.subplebbitAddress] || account.blockedAddresses[post.author.address]) {
                //   continue
                // }
                filteredSortedBufferedFeedPosts.push(post);
            }
            newBufferedFeeds[feedName] = filteredSortedBufferedFeedPosts;
        }
        return newBufferedFeeds;
    }, [feedsOptions, sortedPostsPages, loadedFeeds]);
}
/**
 * Use the `feedSortedPostsInfo` objects to fetch the first page of all subplebbit/sorts
 * if the `feedSortedPostsInfo.bufferedPostCount` gets too low, start fetching the next page.
 * Once a next page is added, it is never removed.
 */
function useSortedPostsPages(feedsSortedPostsInfo, subplebbits) {
    const accountsContext = useContext(AccountsContext);
    const [sortedPostsPages, setSortedPostsPages] = useState({});
    // set the info necessary to fetch each page recursively
    // if bufferedPostCount is less than subplebbitPostsLeftBeforeNextPage
    const sortedPostsPagesInfo = useMemo(() => {
        var _a, _b;
        const newSortedPostsPagesInfo = {};
        for (const infoName in feedsSortedPostsInfo) {
            const { firstPageSortedPostsCid, account, subplebbitAddress, sortType, bufferedPostCount } = feedsSortedPostsInfo[infoName];
            // add first page
            const sortedPostsFirstPageInfo = { sortedPostsCid: firstPageSortedPostsCid, account, subplebbitAddress, sortType,
                // add preloaded sorted posts if any
                sortedPosts: (_b = (_a = subplebbits === null || subplebbits === void 0 ? void 0 : subplebbits[subplebbitAddress]) === null || _a === void 0 ? void 0 : _a.sortedPosts) === null || _b === void 0 ? void 0 : _b[sortType]
            };
            newSortedPostsPagesInfo[firstPageSortedPostsCid + infoName] = sortedPostsFirstPageInfo;
            // add all next pages if needed and if available
            if (bufferedPostCount <= subplebbitPostsLeftBeforeNextPage) {
                const subplebbitPages = getSubplebbitSortedPostsPages(firstPageSortedPostsCid, sortedPostsPages);
                for (const page of subplebbitPages) {
                    if (page.nextSortedCommentsCid) {
                        const sortedPostsNextPageInfo = { sortedPostsCid: page.nextSortedCommentsCid, account, subplebbitAddress, sortType };
                        newSortedPostsPagesInfo[page.nextSortedCommentsCid + infoName] = sortedPostsNextPageInfo;
                    }
                }
            }
        }
        return newSortedPostsPagesInfo;
    }, [feedsSortedPostsInfo, sortedPostsPages]);
    // fetch sorted posts pages if needed
    // once a page is added, it's never removed
    useEffect(() => {
        for (const infoName in sortedPostsPagesInfo) {
            const { sortedPostsCid, account, subplebbitAddress, sortedPosts } = sortedPostsPagesInfo[infoName];
            // sorted posts already fetched or fetching
            if (sortedPostsPages[sortedPostsCid] || getSortedPostsPending[account.id + sortedPostsCid]) {
                continue;
            }
            // the sorted posts page was already preloaded in the subplebbit IPNS record
            if (sortedPosts) {
                setSortedPostsPages(previousSortedPostsPages => (Object.assign(Object.assign({}, previousSortedPostsPages), { [sortedPostsCid]: sortedPosts })));
                continue;
            }
            ;
            (() => __awaiter(this, void 0, void 0, function* () {
                // sorted posts page is cached
                const cachedSortedPostsPage = yield sortedPostsDatabase.getItem(sortedPostsCid);
                if (cachedSortedPostsPage) {
                    setSortedPostsPages(previousSortedPostsPages => (Object.assign(Object.assign({}, previousSortedPostsPages), { [sortedPostsCid]: cachedSortedPostsPage })));
                    return;
                }
                getSortedPostsPending[account.id + sortedPostsCid] = true;
                const subplebbit = account.plebbit.createSubplebbit({ address: subplebbitAddress });
                const fetchedSortedPostsPage = yield subplebbit.getSortedPosts(sortedPostsCid);
                yield sortedPostsDatabase.setItem(sortedPostsCid, fetchedSortedPostsPage);
                debug('FeedsProvider useSortedPostsPages subplebbit.getSortedPosts', { sortedPostsCid, infoName, sortedPosts: { nextSortedCommentsCid: fetchedSortedPostsPage.nextSortedCommentsCid, commentsLength: fetchedSortedPostsPage.comments.length, feedsSortedPostsInfo } });
                setSortedPostsPages(previousSortedPostsPages => (Object.assign(Object.assign({}, previousSortedPostsPages), { [sortedPostsCid]: fetchedSortedPostsPage })));
                getSortedPostsPending[account.id + sortedPostsCid] = false;
                // when publishing a comment, you don't yet know its CID
                // so when a new comment is fetched, check to see if it's your own
                // comment, and if yes, add the CID to your account comments database
                if (accountsContext === null || accountsContext === void 0 ? void 0 : accountsContext.addCidToAccountComment) {
                    const flattenedReplies = utils.flattenSortedComments(fetchedSortedPostsPage);
                    for (const comment of flattenedReplies) {
                        accountsContext.addCidToAccountComment(comment);
                    }
                }
            }))();
        }
    }, [sortedPostsPagesInfo]);
    return sortedPostsPages;
}
const getSortedPostsPending = {};
/**
 * Util function to gather in an array all loaded `SortedComments` pages of a subplebbit/sort
 * using `SortedComments.nextSortedCommentsCid`
 */
const getSubplebbitSortedPostsPages = (firstPageSortedPostsCid, sortedPostsPages) => {
    var _a;
    const pages = [];
    const firstPage = sortedPostsPages[firstPageSortedPostsCid];
    if (!firstPage) {
        return pages;
    }
    pages.push(firstPage);
    while (true) {
        const nextSortedCommentsCid = (_a = pages[pages.length - 1]) === null || _a === void 0 ? void 0 : _a.nextSortedCommentsCid;
        const sortedPostsPage = sortedPostsPages[nextSortedCommentsCid];
        if (!sortedPostsPage) {
            return pages;
        }
        pages.push(sortedPostsPage);
    }
};
/**
 * Generate a list of `feedSortedPostsInfo` objects which contain the information required
 * to initiate fetching the pages of each subplebbit/sort/account/feed
 */
function useFeedsSortedPostsInfo(feedsOptions, subplebbits, bufferedFeeds) {
    const bufferedFeedsSubplebbitsPostCounts = useBufferedFeedsSubplebbitsPostCounts(feedsOptions, bufferedFeeds);
    return useMemo(() => {
        var _a;
        const feedsSortedPostsInfo = {};
        for (const feedName in feedsOptions) {
            const { subplebbitAddresses, sortType, account } = feedsOptions[feedName];
            for (const subplebbitAddress of subplebbitAddresses) {
                const subplebbit = subplebbits[subplebbitAddress];
                const sortedPostsCid = (_a = subplebbit === null || subplebbit === void 0 ? void 0 : subplebbit.sortedPostsCids) === null || _a === void 0 ? void 0 : _a[sortType];
                if (!sortedPostsCid) {
                    continue;
                }
                const feedSortedPostsInfo = {
                    firstPageSortedPostsCid: sortedPostsCid,
                    account,
                    subplebbitAddress,
                    sortType,
                    bufferedPostCount: bufferedFeedsSubplebbitsPostCounts[feedName][subplebbitAddress]
                };
                feedsSortedPostsInfo[account.id + subplebbitAddress + sortType] = feedSortedPostsInfo;
            }
        }
        return feedsSortedPostsInfo;
        // don't use bufferedFeeds to rerender, only rerender on feedOptions.pageNumber change, or subplebbit.sortedPostsCids change
    }, [feedsOptions, subplebbits]);
}
/**
 * This convoluted hook is required to keep track of how many posts are left buffered in each subplebbit,
 * each sort, and each feed. If the amount gets too low, a new page can be fetched in advance.
 */
function useBufferedFeedsSubplebbitsPostCounts(feedsOptions, bufferedFeeds) {
    return useMemo(() => {
        const feedsSubplebbitsPostCounts = {};
        for (const feedName in feedsOptions) {
            feedsSubplebbitsPostCounts[feedName] = {};
            for (const subplebbitAddress of feedsOptions[feedName].subplebbitAddresses) {
                feedsSubplebbitsPostCounts[feedName][subplebbitAddress] = 0;
            }
            for (const comment of bufferedFeeds[feedName]) {
                feedsSubplebbitsPostCounts[feedName][comment.subplebbitAddress]++;
            }
        }
        return feedsSubplebbitsPostCounts;
    }, [bufferedFeeds]);
}
/**
 * Add subplebbits to SubplebbitsContext as they are needed, and return them as an object
 */
function useSubplebbits(feedsOptions) {
    const subplebbitAddressesAndAccounts = useUniqueSortedSubplebbitAddressesAndAccounts(feedsOptions);
    const subplebbitsContext = useContext(SubplebbitsContext);
    const subplebbits = {};
    for (const [subplebbitAddress] of subplebbitAddressesAndAccounts) {
        subplebbits[subplebbitAddress] = subplebbitsContext.subplebbits[subplebbitAddress];
    }
    useEffect(() => {
        for (const [subplebbitAddress, account] of subplebbitAddressesAndAccounts) {
            // if subplebbit isn't already in context, add it
            if (!subplebbitsContext.subplebbits[subplebbitAddress]) {
                subplebbitsContext.subplebbitsActions.addSubplebbitToContext(subplebbitAddress, account);
            }
        }
    }, [subplebbitAddressesAndAccounts]);
    // debug('FeedsProvider useSubplebbits', { subplebbitsContext: subplebbitsContext.subplebbits })
    return subplebbits;
}
/**
 * Util function of useSubplebbits to not rerender unnecessarily
 */
function useUniqueSortedSubplebbitAddressesAndAccounts(feedsOptions) {
    return useMemo(() => {
        const accounts = {};
        const subplebbitAddressesAndAccountsStrings = [];
        for (const feedName in feedsOptions) {
            const feedOptions = feedsOptions[feedName];
            accounts[feedOptions.account.id] = feedOptions.account;
            for (const subplebbitAddress of feedOptions.subplebbitAddresses) {
                subplebbitAddressesAndAccountsStrings.push(JSON.stringify([subplebbitAddress, feedOptions.account.id]));
            }
        }
        const uniqueSortedStrings = [...new Set(subplebbitAddressesAndAccountsStrings.sort())];
        const uniqueSorted = uniqueSortedStrings.map(string => JSON.parse(string));
        return uniqueSorted.map(([subplebbitAddress, accountId]) => [subplebbitAddress, accounts[accountId]]);
    }, [feedsOptions]);
}