export interface GasCostEstimate {
  l2ExecutionCost: bigint;
  l1DataFee: bigint;
  daFee: bigint;
  total: bigint;
  breakdown: {
    l2Gas: bigint;
    l2GasPrice: bigint;
    l1GasUsed?: bigint;
    l1GasPrice?: bigint;
  };
}
