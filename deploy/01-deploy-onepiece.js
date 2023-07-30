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

    let vrfCoordinatorv2Address, subscritptionId;
    if (developmentChains.includes(network.name)) {
        const vrfCoordinatorV2Mock = await ethers.getContract(
            "VRFCoordinatorV2Mock"
        );
        vrfCoordinatorv2Address = vrfCoordinatorV2Mock.getAddress();

        const transactionResponse =
            await vrfCoordinatorV2Mock.createSubscription();
        const transactionReciept = await transactionResponse.wait(1);
        subscritptionId = transactionReciept.events[0].args.subId;
        await vrfCoordinatorV2Mock.fundSubscription(
            subscritptionId,
            VRF_SUB_FUND_AMOUNT
        );
    } else {
        vrfCoordinatorv2Address = networkConfig[chainId]["vrfCoordinatorV2"];
        subscritptionId = networkConfig[chainId]["subscriptionId"];
    }

    const entranceFee = networkConfig[chainId]["entranceFee"];
    const gasLane = networkConfig[chainId]["gasLane"];
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
    const interval = networkConfig[chainId]["callbackGasLimit"];

    args = [
        vrfCoordinatorv2Address,
        entranceFee,
        gasLane,
        subscritptionId,
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
