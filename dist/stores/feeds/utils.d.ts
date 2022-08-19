import { Feed, Feeds, FeedOptions, FeedsOptions, Subplebbits, Accounts, SubplebbitsPages, FeedsSubplebbitsPostCounts } from '../../types';
/**
 * Calculate the final buffered feeds from all the loaded subplebbit pages, sort them,
 * and remove the posts already loaded in loadedFeeds
 */
export declare const getBufferedFeeds: (feedsOptions: FeedsOptions, loadedFeeds: Feeds, subplebbits: Subplebbits, subplebbitsPages: SubplebbitsPages, accounts: Accounts) => Feeds;
export declare const getLoadedFeeds: (feedsOptions: FeedsOptions, loadedFeeds: Feeds, bufferedFeeds: Feeds) => Feeds;
export declare const getBufferedFeedsWithoutLoadedFeeds: (bufferedFeeds: Feeds, loadedFeeds: Feeds) => Feeds;
export declare const getFeedsSubplebbitsPostCounts: (feedsOptions: FeedsOptions, feeds: Feeds) => FeedsSubplebbitsPostCounts;
/**
 * Get which feeds have more posts, i.e. have no reached the final page of all subs
 */
export declare const getFeedsHaveMore: (feedsOptions: FeedsOptions, bufferedFeeds: Feeds, subplebbits: Subplebbits, subplebbitsPages: SubplebbitsPages, accounts: Accounts) => {
    [feedName: string]: boolean;
};
export declare const getFeedAfterIncrementPageNumber: (feedName: string, feedOptions: FeedOptions, bufferedFeed: Feed, loadedFeed: Feed, subplebbits: Subplebbits, subplebbitsPages: SubplebbitsPages, accounts: Accounts) => {
    bufferedFeed: Feed;
    loadedFeed: Feed;
    bufferedFeedSubplebbitsPostCounts: import("../../types").FeedSubplebbitsPostCounts;
    feedHasMore: boolean;
};
export declare const getFeedsSubplebbitsFirstPageCids: (feedsOptions: FeedsOptions, subplebbits: Subplebbits) => string[];
export declare const getAccountsBlockedAddresses: (accounts: Accounts) => string[];
export declare const feedsHaveChangedBlockedAddresses: (feedsOptions: FeedsOptions, bufferedFeeds: Feeds, blockedAddresses: string[], previousBlockedAddresses: string[]) => boolean;