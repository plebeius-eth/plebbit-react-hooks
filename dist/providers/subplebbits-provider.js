var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import React, { useState } from 'react';
import localForageLru from '../lib/localforage-lru';
const subplebbitsDatabase = localForageLru.createInstance({ name: 'subplebbits', size: 500 });
import Debug from 'debug';
const debug = Debug('plebbitreacthooks:providers:subplebbitsprovider');
import utils from '../lib/utils';
export const SubplebbitsContext = React.createContext(undefined);
const plebbitGetSubplebbitPending = {};
export default function SubplebbitsProvider(props) {
    const [subplebbits, setSubplebbits] = useState({});
    const subplebbitsActions = {};
    subplebbitsActions.addSubplebbitToContext = (subplebbitAddress, account) => __awaiter(this, void 0, void 0, function* () {
        // subplebbit is in context already, do nothing
        let subplebbit = subplebbits[subplebbitAddress];
        if (subplebbit || plebbitGetSubplebbitPending[subplebbitAddress + account.id]) {
            return;
        }
        // try to find subplebbit in database
        subplebbit = yield getSubplebbitFromDatabase(subplebbitAddress, account);
        // subplebbit not in database, fetch from plebbit-js
        if (!subplebbit) {
            plebbitGetSubplebbitPending[subplebbitAddress + account.id] = true;
            subplebbit = yield account.plebbit.getSubplebbit(subplebbitAddress);
            yield subplebbitsDatabase.setItem(subplebbitAddress, utils.clone(subplebbit));
        }
        debug('subplebbitsActions.addSubplebbitToContext', { subplebbitAddress, subplebbit, account });
        setSubplebbits((previousSubplebbits) => (Object.assign(Object.assign({}, previousSubplebbits), { [subplebbitAddress]: utils.clone(subplebbit) })));
        plebbitGetSubplebbitPending[subplebbitAddress + account.id] = false;
        // the subplebbit has published new posts
        subplebbit.on('update', (updatedSubplebbit) => __awaiter(this, void 0, void 0, function* () {
            updatedSubplebbit = utils.clone(updatedSubplebbit);
            yield subplebbitsDatabase.setItem(subplebbitAddress, updatedSubplebbit);
            debug('subplebbitsContext subplebbit update', { subplebbitAddress, updatedSubplebbit, account });
            setSubplebbits((previousSubplebbits) => (Object.assign(Object.assign({}, previousSubplebbits), { [subplebbitAddress]: updatedSubplebbit })));
        }));
        subplebbit.update();
    });
    if (!props.children) {
        return null;
    }
    const subplebbitsContext = {
        subplebbits,
        subplebbitsActions,
    };
    debug({ subplebbitsContext: subplebbits });
    return React.createElement(SubplebbitsContext.Provider, { value: subplebbitsContext }, props.children);
}
const getSubplebbitFromDatabase = (subplebbitAddress, account) => __awaiter(void 0, void 0, void 0, function* () {
    const subplebbitData = yield subplebbitsDatabase.getItem(subplebbitAddress);
    if (!subplebbitData) {
        return;
    }
    const subplebbit = account.plebbit.createSubplebbit(subplebbitData);
    // add potential missing data from the database onto the subplebbit instance
    for (const prop in subplebbitData) {
        if (subplebbit[prop] === undefined || subplebbit[prop] === null) {
            if (subplebbitData[prop] !== undefined && subplebbitData[prop] !== null)
                subplebbit[prop] = subplebbitData[prop];
        }
    }
    return subplebbit;
});