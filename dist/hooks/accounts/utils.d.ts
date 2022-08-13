import type { UseAccountCommentsFilter, AccountsCommentsReplies, AccountsComments, Accounts, AccountsNotifications } from '../../types';
/**
 * Filter publications, for example only get comments that are posts, votes in a certain subplebbit, etc.
 * Check UseAccountCommentsFilter type in types.tsx for more information, e.g. filter = {subplebbitAddresses: ['memes.eth']}.
 */
export declare const filterPublications: (publications: any, filter: UseAccountCommentsFilter) => any[];
export declare const useAccountsNotifications: (accounts?: Accounts | undefined, accountsCommentsReplies?: AccountsCommentsReplies | undefined) => AccountsNotifications;
export declare const useAccountsWithCalculatedProperties: (accounts?: Accounts | undefined, accountsComments?: AccountsComments | undefined, accountsCommentsReplies?: AccountsCommentsReplies | undefined) => Accounts | undefined;