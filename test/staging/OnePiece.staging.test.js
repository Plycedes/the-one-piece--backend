const { getNamedAccounts, deployments, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");

developmentChains.includes(network.name)
    ? describe.skip
    : describe("OnePiece", async function () {
          let onepiece, vrfCoordinatorV2Mock, deployer, entranceFee, interval;
          const chainId = network.config.chainId;

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer;
              onepiece = await ethers.getContract("OnePiece", deployer);
              entranceFee = await onepiece.getEntranceFee();
          });

          describe("fulfillRandomWords", function () {
              it("works with live ChainLink Keepers and and ChainLink VRF, we get a random winner", async function () {
                  console.log("Setting up tests");
                  const startingTimeStamp = await onepiece.getLatestTimeStamp();
                  const accounts = await ethers.getSigners();

                  console.log("Setting up listner...");
                  await new Promise(async (resolve, reject) => {
                      onepiece.once("FinderPicked", async () => {
                          console.log("FinderPicked event called!");
                          try {
                              const recentWinner = await onepiece.getRecentFinder();
                              const treasureState = await onepiece.getTreasureState();
                              const winnerEndingBalance = await accounts[0].getBalance();
                              const endingTimeStamp = await onepiece.getLatestTimeStamp();

                              await expect(onepiece.getPlayer(0)).to.be.reverted;
                              assert.equal(recentWinner.toString(), accounts[0].address);
                              assert.equal(treasureState, 0);
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance.add(entranceFee).toString()
                              );
                              assert(endingTimeStamp > startingTimeStamp);
                              resolve();
                          } catch (e) {
                              console.log(e);
                              reject(e);
                          }
                      });
                      console.log("Entering one piece race");
                      const tx = await onepiece.enterOnePieceRace({ value: entranceFee });
                      await tx.wait(1);
                      console.log("Time to wait...");
                      const winnerStartingBalance = await accounts[0].getBalance();
                      console.log("Winner balance acquired...");
                  });
              });
          });
      });
