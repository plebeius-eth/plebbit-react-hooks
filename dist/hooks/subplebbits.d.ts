import { BlockchainProviders, UseResolvedSubplebbitAddressOptions, UseResolvedSubplebbitAddressResult, UseSubplebbitOptions, UseSubplebbitResult, UseSubplebbitsOptions, UseSubplebbitsResult, UseSubplebbitMetricsOptions, UseSubplebbitMetricsResult } from '../types';
/**
 * @param subplebbitAddress - The address of the subplebbit, e.g. 'memes.eth', 'Qm...', etc
 * @param acountName - The nickname of the account, e.g. 'Account 1'. If no accountName is provided, use
 * the active account.
 */
export declare function useSubplebbit(options?: UseSubplebbitOptions): UseSubplebbitResult;
/**
 * @param subplebbitAddress - The address of the subplebbit, e.g. 'memes.eth', 'Qm...', etc
 * @param acountName - The nickname of the account, e.g. 'Account 1'. If no accountName is provided, use
 * the active account.
 */
export declare function useSubplebbitMetrics(options?: UseSubplebbitMetricsOptions): UseSubplebbitMetricsResult;
/**
 * @param subplebbitAddresses - The addresses of the subplebbits, e.g. ['memes.eth', 'Qm...']
 * @param acountName - The nickname of the account, e.g. 'Account 1'. If no accountName is provided, use
 * the active account.
 */
export declare function useSubplebbits(options?: UseSubplebbitsOptions): UseSubplebbitsResult;
/**
 * Returns all the owner subplebbits created by plebbit-js by calling plebbit.listSubplebbits()
 */
export declare function useListSubplebbits(): string[];
/**
 * @param subplebbitAddress - The subplebbit address to resolve to a public key, e.g. 'news.eth' resolves to 'Qm...'.
 * @param acountName - The nickname of the account, e.g. 'Account 1'. If no accountName is provided, use
 * the active account.
 */
export declare function useResolvedSubplebbitAddress(options?: UseResolvedSubplebbitAddressOptions): UseResolvedSubplebbitAddressResult;
export declare const resolveSubplebbitAddress: (subplebbitAddress: string, blockchainProviders: BlockchainProviders) => Promise<any>;
