import { Subplebbits } from '../../types';
export declare const listeners: any;
declare type SubplebbitsState = {
    subplebbits: Subplebbits;
    addSubplebbitToStore: Function;
    editSubplebbit: Function;
    createSubplebbit: Function;
};
declare const useSubplebbitsStore: import("zustand").UseBoundStore<import("zustand").StoreApi<SubplebbitsState>>;
export declare const resetSubplebbitsStore: () => Promise<void>;
export declare const resetSubplebbitsDatabaseAndStore: () => Promise<void>;
export default useSubplebbitsStore;