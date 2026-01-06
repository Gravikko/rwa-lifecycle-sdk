import type { Address, PublicClient } from 'viem';
import { ERC3643_TOKEN_ABI, IDENTITY_REGISTRY_ABI } from './abi.js';
import { ERC3643Error } from '../errors.js';

/**
 * Identity information from the ERC3643 Identity Registry
 */
export interface IdentityInfo {
  /** Whether the address is verified in the registry */
  isVerified: boolean;

  /** Whether the address is registered (may not be verified) */
  isRegistered: boolean;

  /** Country code (ISO 3166-1 numeric) where investor is registered */
  country?: number;

  /** Identity contract address (ONCHAINID) */
  identityAddress?: Address;
}

/**
 * Get the Identity Registry address from an ERC3643 token
 *
 * @param publicClient - Viem public client
 * @param tokenAddress - ERC3643 token contract address
 * @returns Address of the Identity Registry contract
 */
export async function getIdentityRegistryAddress(
  publicClient: PublicClient,
  tokenAddress: Address
): Promise<Address> {
  try {
    const registryAddress = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC3643_TOKEN_ABI,
      functionName: 'identityRegistry',
    });

    return registryAddress;
  } catch (error) {
    throw new ERC3643Error(
      `Failed to get identity registry address: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
      tokenAddress
    );
  }
}

/**
 * Get detailed identity information for an address from the Identity Registry
 *
 * This provides more information than the token's isVerified() function,
 * including country registration and identity contract address.
 *
 * @param publicClient - Viem public client
 * @param tokenAddress - ERC3643 token contract address
 * @param userAddress - Address to query
 * @returns Detailed identity information
 */
export async function getIdentityInfo(
  publicClient: PublicClient,
  tokenAddress: Address,
  userAddress: Address
): Promise<IdentityInfo> {
  try {
    // Get the Identity Registry address
    const registryAddress = await getIdentityRegistryAddress(publicClient, tokenAddress);

    // Query all identity information in parallel
    const [isVerified, isRegistered, country, identityAddress] = await Promise.all([
      // Check verification status
      publicClient.readContract({
        address: registryAddress,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'isVerified',
        args: [userAddress],
      }).catch(() => false),

      // Check if registered (may not be verified yet)
      publicClient.readContract({
        address: registryAddress,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'contains',
        args: [userAddress],
      }).catch(() => false),

      // Get investor country
      publicClient.readContract({
        address: registryAddress,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'investorCountry',
        args: [userAddress],
      }).catch(() => undefined),

      // Get identity contract address
      publicClient.readContract({
        address: registryAddress,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'identity',
        args: [userAddress],
      }).catch(() => undefined),
    ]);

    return {
      isVerified,
      isRegistered,
      country: country !== undefined ? Number(country) : undefined,
      identityAddress: identityAddress !== '0x0000000000000000000000000000000000000000'
        ? identityAddress
        : undefined,
    };
  } catch (error) {
    throw new ERC3643Error(
      `Failed to get identity info: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
      tokenAddress
    );
  }
}

/**
 * Check if an address is verified in the Identity Registry
 *
 * This is a direct query to the Identity Registry contract,
 * which may give different results than token.isVerified()
 * in some implementations.
 *
 * @param publicClient - Viem public client
 * @param registryAddress - Identity Registry contract address
 * @param userAddress - Address to check
 * @returns true if verified, false otherwise
 */
export async function isVerifiedInRegistry(
  publicClient: PublicClient,
  registryAddress: Address,
  userAddress: Address
): Promise<boolean> {
  try {
    const verified = await publicClient.readContract({
      address: registryAddress,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'isVerified',
      args: [userAddress],
    });

    return verified;
  } catch (error) {
    throw new ERC3643Error(
      `Failed to check verification in registry: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
      registryAddress
    );
  }
}

/**
 * Get the country code for an investor
 *
 * Returns the ISO 3166-1 numeric country code where the investor
 * is registered in the Identity Registry.
 *
 * @param publicClient - Viem public client
 * @param registryAddress - Identity Registry contract address
 * @param userAddress - Address to query
 * @returns Country code (e.g., 840 for USA, 124 for Canada)
 */
export async function getInvestorCountry(
  publicClient: PublicClient,
  registryAddress: Address,
  userAddress: Address
): Promise<number> {
  try {
    const country = await publicClient.readContract({
      address: registryAddress,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'investorCountry',
      args: [userAddress],
    });

    return Number(country);
  } catch (error) {
    throw new ERC3643Error(
      `Failed to get investor country: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
      registryAddress
    );
  }
}
