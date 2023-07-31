const { network, ethers } = require("hardhat");
const {
    developmentChains,
    networkConfig,
} = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

const VRF_SUB_FUND_AMOUNT = ethers.parseEther("0.02");

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;

    let vrfCoordinatorv2Address, subscriptionId, vrfCoordinatorV2Mock;
    if (developmentChains.includes(network.name)) {
        vrfCoordinatorV2Mock = await deployments.get("VRFCoordinatorV2Mock");
        vrfCoordinatorv2Address = vrfCoordinatorV2Mock.address;

        const transactionResponse =
            await vrfCoordinatorV2Mock.createSubscription();
        const transactionReciept = await transactionResponse.wait(1);
        log(transactionReciept);
        subscritptionId = transactionReciept.events[1].args.subId;
        await vrfCoordinatorV2Mock.fundSubscription(
            subscritptionId,
            VRF_SUB_FUND_AMOUNT
        );
        //subscriptionId = 0;
    } else {
        vrfCoordinatorv2Address = networkConfig[chainId]["vrfCoordinatorV2"];
        subscriptionId = networkConfig[chainId]["subscriptionId"];
    }

    const entranceFee = networkConfig[chainId]["entranceFee"];
    const gasLane = networkConfig[chainId]["gasLane"];
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
    const interval = networkConfig[chainId]["interval"];

    args = [
        vrfCoordinatorv2Address,
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

    if (
        !developmentChains.includes(network.name) &&
        process.env.ETHERSCAN_API_KEY
    ) {
        log("Verifying...");
        await verify(onepiece.address, args);
    }
    log("---------------------------------------------------------");
};

module.exports.tags = ["all", "raffle"];
