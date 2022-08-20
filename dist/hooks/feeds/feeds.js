import { useEffect, useMemo } from 'react';
import { useAccount } from '../accounts';
import validator from '../../lib/validator';
import Logger from '@plebbit/plebbit-logger';
const log = Logger('plebbit-react-hooks:hooks:feeds');
import useFeedsStore from '../../stores/feeds';
/**
 * @param subplebbitAddresses - The addresses of the subplebbits, e.g. ['memes.eth', 'Qm...']
 * @param sortType - The sorting algo for the feed: 'hot' | 'new' | 'topHour'| 'topDay' | 'topWeek' | 'topMonth' | 'topYear' | 'topAll'
 * @param acountName - The nickname of the account, e.g. 'Account 1'. If no accountName is provided, use
 * the active account.
 */
export function useFeed(subplebbitAddresses, sortType = 'hot', accountName) {
    validator.validateUseFeedArguments(subplebbitAddresses, sortType, accountName);
    const account = useAccount(accountName);
    const addFeedToStore = useFeedsStore((state) => state.addFeedToStore);
    const incrementFeedPageNumber = useFeedsStore((state) => state.incrementFeedPageNumber);
    const [uniqueSubplebbitAddresses] = useUniqueSorted([subplebbitAddresses]);
    const [feedName] = useStringified([[account === null || account === void 0 ? void 0 : account.id, sortType, uniqueSubplebbitAddresses]]);
    useEffect(() => {
        if (!uniqueSubplebbitAddresses || !account) {
            return;
        }
        addFeedToStore(feedName, uniqueSubplebbitAddresses, sortType, account).catch((error) => log.error('useFeed addFeedToStore error', { feedName, error }));
    }, [feedName /*, uniqueSubplebbitAddresses?.toString(), sortType, account?.id*/]);
    const loadedFeed = useFeedsStore((state) => state.loadedFeeds[feedName || ''], feedShallowEqual);
    let hasMore = useFeedsStore((state) => state.feedsHaveMore[feedName || '']);
    // if the feed is not yet defined, then it has more
    if (!feedName || typeof hasMore !== 'boolean') {
        hasMore = true;
    }
    const loadMore = () => {
        if (!uniqueSubplebbitAddresses || !account) {
            throw Error('useFeed cannot load more feed not initalized yet');
        }
        incrementFeedPageNumber(feedName);
    };
    const feed = loadedFeed || [];
    if (account && (subplebbitAddresses === null || subplebbitAddresses === void 0 ? void 0 : subplebbitAddresses.length)) {
        log('useFeed', {
            feed: feed.length,
            hasMore,
            subplebbitAddresses,
            sortType,
            account,
            feedsStoreOptions: useFeedsStore.getState().feedsOptions,
            feedsStore: useFeedsStore.getState(),
        });
    }
    return { feed, hasMore, loadMore };
}
/**
 * Use useBufferedFeeds to buffer multiple feeds in the background so what when
 * they are called by useFeed later, they are already preloaded.
 *
 * @param feedOptions - The options of the feed
 * @param acountName - The nickname of the account, e.g. 'Account 1'. If no accountName is provided, use
 * the active account.
 */
export function useBufferedFeeds(feedsOptions = [], accountName) {
    validator.validateUseBufferedFeedsArguments(feedsOptions, accountName);
    const account = useAccount(accountName);
    const addFeedToStore = useFeedsStore((state) => state.addFeedToStore);
    // do a bunch of calculations to get feedsOptionsFlattened and feedNames
    const subplebbitAddressesArrays = [];
    const sortTypes = [];
    for (const feedOptions of feedsOptions) {
        subplebbitAddressesArrays.push(feedOptions.subplebbitAddresses);
        sortTypes.push(feedOptions.sortType);
    }
    const uniqueSubplebbitAddressesArrays = useUniqueSorted(subplebbitAddressesArrays);
    const feedsOptionsFlattened = [];
    for (const i in feedsOptions) {
        feedsOptionsFlattened[i] = [account === null || account === void 0 ? void 0 : account.id, sortTypes[i] || 'hot', uniqueSubplebbitAddressesArrays[i]];
    }
    const feedNames = useStringified(feedsOptionsFlattened);
    const bufferedFeeds = useFeedsStore((state) => {
        const bufferedFeeds = {};
        for (const feedName of feedNames) {
            if (!feedName) {
                continue;
            }
            bufferedFeeds[feedName] = state.bufferedFeeds[feedName];
        }
        return bufferedFeeds;
    }, feedsShallowEqual);
    useEffect(() => {
        for (const i in feedsOptionsFlattened) {
            const [accountId, sortType, uniqueSubplebbitAddresses] = feedsOptionsFlattened[Number(i)];
            validator.validateFeedSortType(sortType);
            const feedName = feedNames[Number(i)];
            if (!uniqueSubplebbitAddresses || !account) {
                return;
            }
            if (!bufferedFeeds[feedName || '']) {
                const isBufferedFeed = true;
                addFeedToStore(feedName, uniqueSubplebbitAddresses, sortType, account, isBufferedFeed).catch((error) => log.error('useBufferedFeeds addFeedToStore error', { feedName, error }));
            }
        }
    }, [feedNames === null || feedNames === void 0 ? void 0 : feedNames.toString()]);
    // only give to the user the buffered feeds he requested
    const bufferedFeedsArray = [];
    for (const feedName of feedNames) {
        bufferedFeedsArray.push(bufferedFeeds[feedName || ''] || []);
    }
    if (account && (feedsOptions === null || feedsOptions === void 0 ? void 0 : feedsOptions.length)) {
        log('useBufferedFeeds', {
            bufferedFeeds,
            feedsOptions,
            account,
            accountName,
            feedsStoreOptions: useFeedsStore.getState().feedsOptions,
            feedsStore: useFeedsStore.getState(),
        });
    }
    return bufferedFeedsArray;
}
/**
 * Util to find unique and sorted subplebbit addresses for multiple feed options
 */
function useUniqueSorted(stringsArrays) {
    return useMemo(() => {
        const uniqueSorted = [];
        for (const stringsArray of stringsArrays || []) {
            if (!stringsArray) {
                uniqueSorted.push(undefined);
            }
            else {
                uniqueSorted.push([...new Set(stringsArray.sort())]);
            }
        }
        return uniqueSorted;
    }, [stringsArrays === null || stringsArrays === void 0 ? void 0 : stringsArrays.toString()]);
}
/**
 * Util to stringify multiple objects or return undefineds
 */
function useStringified(objs) {
    return useMemo(() => {
        const stringified = [];
        for (const obj of objs || []) {
            if (obj === undefined) {
                stringified.push(undefined);
            }
            else {
                stringified.push(JSON.stringify(obj));
            }
        }
        return stringified;
    }, [JSON.stringify(objs)]);
}
/**
 * Equality function for if a feed has changed
 */
function feedShallowEqual(feedA, feedB) {
    // handled undefined feeds
    if (!feedA && !feedB) {
        return true;
    }
    if (!feedA && feedB) {
        return false;
    }
    if (feedA && !feedB) {
        return false;
    }
    // fix typescript warning
    feedA = feedA || [];
    feedB = feedB || [];
    // feeds have different lengths, not equal
    if (feedA.length !== feedB.length) {
        return false;
    }
    // a post cid is different, not equal
    let index = feedA.length;
    while (index--) {
        if (feedA[index].cid !== feedB[index].cid) {
            return false;
        }
    }
    return true;
}
/**
 * Equality function for if any feed in feeds have changed
 */
function feedsShallowEqual(feedsA, feedsB) {
    // handled undefined feeds
    if (!feedsA && !feedsB) {
        return true;
    }
    if (!feedsA && feedsB) {
        return false;
    }
    if (feedsA && !feedsB) {
        return false;
    }
    // fix typescript warning
    feedsA = feedsA || {};
    feedsB = feedsB || {};
    const feedsANames = Object.keys(feedsA).sort();
    const feedsBNames = Object.keys(feedsB).sort();
    // feeds names are not equal
    if (feedsANames.toString() !== feedsBNames.toString()) {
        return false;
    }
    // a feed is not equal
    const feedNames = new Set([...feedsANames, ...feedsBNames]);
    for (const feedName in feedsA) {
        if (!feedShallowEqual(feedsA[feedName], feedsB[feedName])) {
            return false;
        }
    }
    return true;
}
