import {Account, Role, Subplebbits} from '../../types'
import assert from 'assert'

const getAuthorAddressRolesFromSubplebbits = (authorAddress: string, subplebbits: Subplebbits) => {
  const roles: {[subplebbitAddress: string]: Role} = {}
  for (const subplebbitAddress in subplebbits) {
    const role = subplebbits[subplebbitAddress]?.roles?.[authorAddress]
    if (role) {
      roles[subplebbitAddress] = role
    }
  }
  return roles
}

export const getAccountSubplebbits = (account: Account, subplebbits: Subplebbits) => {
  assert(
    account?.author?.address && typeof account?.author?.address === 'string',
    `accountsStore utils getAccountSubplebbits invalid account.author.address '${account?.author?.address}'`
  )
  assert(subplebbits && typeof subplebbits === 'object', `accountsStore utils getAccountSubplebbits invalid subplebbits '${subplebbits}'`)

  const roles = getAuthorAddressRolesFromSubplebbits(account.author.address, subplebbits)
  const accountSubplebbits = {...account.subplebbits}
  for (const subplebbitAddress in roles) {
    accountSubplebbits[subplebbitAddress] = {...accountSubplebbits[subplebbitAddress]}
    accountSubplebbits[subplebbitAddress].role = roles[subplebbitAddress]
  }
  return accountSubplebbits
}

const utils = {
  getAccountSubplebbits,
}

export default utils