import { FetchOptions, FetchV2, SimpleAdapter } from "../../adapters/types";
import { CHAIN } from "../../helpers/chains";
import { addOneToken } from "../../helpers/prices";

const INITIALIZE_LEGACY_EVENT_ABI = 'event Initialize(bytes32 id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks)';
const INITIALIZE_EVENT_ABI = 'event Initialize(bytes32 id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)';
const SWAP_EVENT_ABI = "event Swap(bytes32 indexed id, address sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)";

const CONFIG = {
  [CHAIN.ZORA]: {
    pool: "0xB43287b2106BC044F07aE674794f5492E851d3dC",
    router: "0x0Fee97363deEFBE4De038D437D805A98dbEbA400",
    fromBlock: 13704184,
    swapFee: 10000000000000n,
    initializeEventAbi: INITIALIZE_LEGACY_EVENT_ABI,
    swapEventAbi: SWAP_EVENT_ABI,
  },
  [CHAIN.BASE]: {
    pool: "0xcdE68374C7AB5cf1DB8673D3Fc80937CC499E3a0",
    router: "0x0Fee2fd9EBFD6B0f803FcDeF0230d53dEF910900",
    fromBlock: 17713836,
    swapFee: 10000000000000n,
    initializeEventAbi: INITIALIZE_EVENT_ABI,
    swapEventAbi: SWAP_EVENT_ABI,
  },
};

type Pair = {
  id: string,
  currency0: string;
  currency1: string;
};

const getTokenPairs = async (options: FetchOptions): Promise<{[id:string]: Pair}> => {
  const config = CONFIG[options.chain];

  const logs = await options.api.getLogs({
    target: config.pool,
    eventAbi: config.initializeEventAbi,
    fromBlock: config.fromBlock,
    toBlock: options.api.block as number,
    onlyArgs: true,
  });

  const pairs = logs.map(log => {
    const [id, currency0, currency1] = log
    return { id, currency0, currency1 }
  });

  return Object.fromEntries(pairs.map((pair) => [pair.id, pair]));
}

const fetchVolume: FetchV2 = async (options: FetchOptions) => {
  const dailyVolume = options.createBalances();
  const dailyFees = options.createBalances();
  const pairs = await getTokenPairs(options);
  
  const config = CONFIG[options.chain];
  const logs = await options.getLogs({
    target: config.pool,
    eventAbi: config.swapEventAbi,
  });
  logs.forEach((log: any) => {
    const [id,,amount0, amount1] = log;
    const pair = pairs[id];
    addOneToken({
      balances: dailyVolume,
      chain: options.chain,
      token0: pair.currency0,
      token1: pair.currency1,
      amount0,
      amount1,
    });
  });
  dailyFees.addGasToken(config.swapFee * BigInt(logs.length));

  return {
    dailyVolume,
    dailyFees,
  }
}

const adapter: SimpleAdapter = {
  version: 2,
  adapter: {
    [CHAIN.ZORA]: {
      fetch: fetchVolume,
      start: 1714060800,
    },
    [CHAIN.BASE]: {
      fetch: fetchVolume,
      start: 1722211200,
    },
  }
}

export default adapter;
