const { getNamedAccounts, deployments, ethers } = require("hardhat");
const {
    developmentChains,
    networkConfig,
} = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("OnePiece", async function () {
          let onepiece, vrfCoordinatorV2Mock, deployer, entranceFee, interval;
          const chainId = network.config.chainId;

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer;
              await deployments.fixture("all");
              onepiece = await ethers.getContract("OnePiece", deployer);
              vrfCoordinatorV2Mock = await ethers.getContract(
                  "VRFCoordinatorV2Mock",
                  deployer
              );
              entranceFee = await onepiece.getEntranceFee();
              interval = await onepiece.getInterval();
          });

          describe("constructor", async function () {
              it("initializes the One Piece race correctly", async function () {
                  const treasureState = await onepiece.getTreasureState();
                  const interval = await onepiece.getInterval();
                  assert.equal(treasureState.toString(), "0");
                  assert.equal(
                      interval.toString(),
                      networkConfig[chainId]["interval"]
                  );
              });
          });

          describe("enterOnePieceRace", async function () {
              it("reverts when you don't pay enough", async function () {
                  await expect(onepiece.enterOnePieceRace()).to.be.rejectedWith(
                      "OnePiece__NotEnoughETHEntered"
                  );
              });
              it("records players when they enter", async function () {
                  await onepiece.enterOnePieceRace({ value: entranceFee });
                  const player = await onepiece.getPlayer(0);
                  assert.equal(player, deployer);
              });
              it("emits event on enter", async function () {
                  await expect(
                      onepiece.enterOnePieceRace({ value: entranceFee })
                  ).to.emit(onepiece, "OnePieceRaceEnter");
              });
              it("doesn't allow entrance when onepiece race has begun", async function () {
                  await onepiece.enterOnePieceRace({ value: entranceFee });
                  await network.provider.send("evm_increaseTime", [
                      Number(interval) + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
                  await onepiece.performUpkeep("0x");
                  await expect(
                      onepiece.enterOnePieceRace({ value: entranceFee })
                  ).to.be.revertedWith("OnePiece_NotOpen");
              });
          });
      });
