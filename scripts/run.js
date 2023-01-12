const main = async () => {
  const [owner, randomPerson] = await hre.ethers.getSigners();
  const domainContractFactory = await hre.ethers.getContractFactory("Domains");
  const domainContract = await domainContractFactory.deploy("dev");
  await domainContract.deployed();
  console.log("Contract deployed to:", domainContract.address);

  let txn = await domainContract.register("abdc", {value: hre.ethers.utils.parseEther("1")});
  await txn.wait();

  txn = await domainContract.register("defg", {value: hre.ethers.utils.parseEther("1")});
  await txn.wait();

  const names = await domainContract.getAllNames();
  console.log(names);
}

const runMain = async () => {
  try {
    await main();
    process.exit(0);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
}

runMain();