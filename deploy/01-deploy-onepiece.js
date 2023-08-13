const { network, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");
const { TransactionReceipt } = require("ethers");

const VRF_SUB_FUND_AMOUNT = ethers.parseEther("0.02");

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;

    let vrfCoordinatorV2Address, subscriptionId, vrfCoordinatorV2Mock;

    if (developmentChains.includes(network.name)) {
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
        //vrfCoordinatorV2Mock = await deployments.get("VRFCoordinatorV2Mock");
        //log(vrfCoordinatorV2Mock);
        vrfCoordinatorV2Address = await vrfCoordinatorV2Mock.getAddress();
        //vrfCoordinatorV2Address = await vrfCoordinatorV2Mock.address;

        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription();
        const transactionReciept = await transactionResponse.wait(1);
        //log(transactionReciept);
        //subscritptionId = await transactionReciept.events[0].args.subId;
        subscriptionId = 1;
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT);
        //subscriptionId = 0;
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"];
        subscriptionId = networkConfig[chainId]["subscriptionId"];
    }

    const entranceFee = networkConfig[chainId]["entranceFee"];
    const gasLane = networkConfig[chainId]["gasLane"];
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
    const interval = networkConfig[chainId]["interval"];

    args = [
        vrfCoordinatorV2Address,
        entranceFee,
        gasLane,
        subscriptionId,
        callbackGasLimit,
        interval,
    ];
    const onepiece = await deploy("OnePiece", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    });
    if (developmentChains.includes(network.name)) {
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId, onepiece.address);
        log("Consumer is added");
    }
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...");
        await verify(onepiece.address, args);
    }
    log("---------------------------------------------------------");
};

module.exports.tags = ["all", "raffle"];
