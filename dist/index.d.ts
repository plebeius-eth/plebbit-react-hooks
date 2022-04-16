import PlebbitProvider from './providers/plebbit-provider';
import { useAccount, useAccounts, useAccountsActions, useAccountComments, useAccountVotes, useAccountVote, useAccountNotifications } from './hooks/accounts';
import { useComment, useComments } from './hooks/comments';
import { useSubplebbit, useSubplebbits } from './hooks/subplebbits';
import { useFeed, useBufferedFeeds } from './hooks/feeds';
import debugUtils from './lib/debug-utils';
export * from './types';
export { PlebbitProvider, useAccount, useAccounts, useAccountsActions, useAccountComments, useAccountVotes, useAccountVote, useAccountNotifications, useComment, useComments, useSubplebbit, useSubplebbits, useFeed, useBufferedFeeds, debugUtils };
declare const hooks: {
    PlebbitProvider: typeof PlebbitProvider;
    useAccount: typeof useAccount;
    useAccounts: typeof useAccounts;
    useAccountsActions: typeof useAccountsActions;
    useAccountComments: typeof useAccountComments;
    useAccountVotes: typeof useAccountVotes;
    useAccountVote: typeof useAccountVote;
    useAccountNotifications: typeof useAccountNotifications;
    useComment: typeof useComment;
    useSubplebbit: typeof useSubplebbit;
    useSubplebbits: typeof useSubplebbits;
    useFeed: typeof useFeed;
    useBufferedFeeds: typeof useBufferedFeeds;
    debugUtils: {
        deleteDatabases: () => Promise<[void, void, any, any, any]>;
    };
};
export default hooks;
