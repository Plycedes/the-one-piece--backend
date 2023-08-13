const { getNamedAccounts, deployments, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");
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
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
              entranceFee = await onepiece.getEntranceFee();
              interval = await onepiece.getInterval();
          });

          describe("constructor", async function () {
              it("initializes the One Piece race correctly", async function () {
                  const treasureState = await onepiece.getTreasureState();
                  const interval = await onepiece.getInterval();
                  assert.equal(treasureState.toString(), "0");
                  assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
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
                  await expect(onepiece.enterOnePieceRace({ value: entranceFee })).to.emit(
                      onepiece,
                      "OnePieceRaceEnter"
                  );
              });

              it("doesn't allow entrance when onepiece race has begun", async function () {
                  await onepiece.enterOnePieceRace({ value: entranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  await onepiece.performUpkeep("0x");
                  await expect(
                      onepiece.enterOnePieceRace({ value: entranceFee })
                  ).to.be.rejectedWith("OnePiece__NotOpen");
              });
          });

          describe("checkUpkeep", async function () {
              it("returns false if people haven't send eth", async function () {
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  const { upkeepNeeded } = await onepiece.checkUpkeep("0x");
                  //const { upkeepNeeded } = await onepiece.callStatic.checkUpkeep("0x");
                  assert(!upkeepNeeded);
              });

              it("returns false if onepiece race isn't open", async function () {
                  await onepiece.enterOnePieceRace({ value: entranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  await onepiece.performUpkeep("0x");
                  const treasureState = await onepiece.getTreasureState();
                  const { upkeepNeeded } = await onepiece.checkUpkeep("0x");
                  //const { upkeepNeeded } = await onepiece.callStatic.checkUpkeep("0x");
                  assert.equal(treasureState.toString(), "1");
                  assert.equal(!upkeepNeeded);
              });

              it("returns false if enough time hasn't passed", async function () {
                  await onepiece.enterOnePieceRace({ value: entranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) - 1]);
                  await network.provider.request({
                      method: "evm_mine",
                      params: [],
                  });
                  const { upkeepNeeded } = await onepiece.checkUpkeep("0x");
                  //const { upkeepNeeded } = await onepiece.callStatic.checkUpkeep("0x");
                  assert(!upkeepNeeded);
              });

              it("returns true if enough time has passed, has players, eth and is open", async function () {
                  await onepiece.enterOnePieceRace({ value: entranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.request({
                      method: "evm_mine",
                      params: [],
                  });
                  const { upkeepNeeded } = await onepiece.checkUpkeep("0x");
                  //const { upkeepNeeded } = await onepiece.callStatic.checkUpkeep("0x");
                  assert(upkeepNeeded, true);
              });
          });

          describe("performUpkeep", function () {
              it("can only run if checkupkeep is true", async function () {
                  await onepiece.enterOnePieceRace({ value: entranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  const tx = await onepiece.performUpkeep("0x");
                  assert(tx);
              });

              it("reverts when checkupkeep is false", async function () {
                  await expect(onepiece.performUpkeep("0x")).to.be.rejectedWith(
                      "OnePiece__UpkeepNotNeeded(0, 0, 0)"
                  );
              });

              it("updates the treasure state, emits an event and calls the vrf coordinator", async function () {
                  await onepiece.enterOnePieceRace({ value: entranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.send("evm_mine", []);
                  const txResponse = await onepiece.performUpkeep("0x");
                  const txReciept = await txResponse.wait(1);
                  const requestId = txReciept.events[1].args.requestId;
                  const treasureState = await onepiece.getTreasureState();
                  assert(Number(requestId) > 0);
                  assert(treasureState.toString() == 1);
              });
          });

          describe("fulfillRandomWords", function () {
              beforeEach(async function () {
                  await onepiece.enterOnePieceRace({ value: entranceFee });
                  await network.provider.send("evm_increaseTime", [Number(interval) + 1]);
                  await network.provider.send("evm_mine", []);
              });

              it("can only be called after performUpkeep", async function () {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, onepiece.getAddress())
                  ).to.be.revertedWith("nonexistent request");
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, onepiece.getAddress())
                  ).to.be.revertedWith("nonexistent request");
              });

              it("picks a winner, resets the lottery and sends money", async function () {
                  const additionalEntrants = 3;
                  const startingAccountIndex = 1;
                  const accounts = await ethers.getSigners();
                  for (
                      let i = startingAccountIndex;
                      i < startingAccountIndex + additionalEntrants;
                      i++
                  ) {
                      const accountConnectedTreasure = onepiece.connect(accounts[i]);
                      await accountConnectedTreasure.enterOnePieceRace({
                          value: entranceFee,
                      });
                      const startingTimeStamp = await onepiece.getLatestTimeStamp();

                      await new Promise(async (resolve, reject) => {
                          onepiece.once("WinnerPicked", async () => {
                              try {
                                  const recentWinner = await onepiece.getRecentFinder();
                                  const treasureState = await onepiece.getTreasureState();
                                  const endingTimeStamp = await onepiece.getLatestTimeStamp();
                                  const numPlayers = await onepiece.getNumOfPlayers();
                                  assert.equal(numPlayers.toString(), "0");
                                  assert.equal(treasureState.toString(), "0");
                                  assert(endingTimeStamp > startingTimeStamp);
                              } catch (e) {
                                  reject(e);
                              }
                              resolve();
                          });

                          const tx = await onepiece.performUpkeep([]);
                          const txReciept = await tx.wait(1);
                          await vrfCoordinatorV2Mock.fulfillRandomWords(
                              txReciept.events[1].args.requestId,
                              await onepiece.getAddress()
                          );
                      });
                  }
              });
          });
      });
