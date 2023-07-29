//SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol";

error OnePiece__UpkeepNotNeeded(uint256 currentBalance, uint256 playerNum, uint256 treasureState);
error OnePiece__NotEnoughETHEntered();
error OnePiece__TransferFailed();
error OnePiece__NotOpen();

contract OnePiece is VRFConsumerBaseV2, AutomationCompatibleInterface {

    // Type Declarations
    enum TreasureState {
        OPEN,
        CALCULATING
    }

    //state variables
    address payable[] private s_players;
    address private s_recentFinder;
    TreasureState private s_treasureState;
    uint256 private s_lastTimeStamp;    

    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    uint256 private immutable i_entranceFee;    
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    uint256 private i_interval;

    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint16 private constant NUM_WORDS = 1;

    event OnePieceRaceEnter(address indexed player);
    event RequestedOnePieceFinder(uint256 indexed requestId);
    event FinderPicked(address indexed finder);

    constructor(
         address vrfCoordinatorV2,
         uint256 entranceFee,
         bytes32 gasLane,
         uint64 subscriptionId,
         uint32 callbackGasLimit,
         uint256 interval
        ) VRFConsumerBaseV2(vrfCoordinatorV2){ 
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_interval = interval;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_treasureState = TreasureState.OPEN;
        s_lastTimeStamp = block.timestamp;        
    }

    function enterOnePieceRace() public payable {
        if(msg.value < i_entranceFee){
            revert OnePiece__NotEnoughETHEntered();
        }
        if(s_treasureState != TreasureState.OPEN){
            revert OnePiece__NotOpen();
        }
        s_players.push(payable(msg.sender));

        // Emit an event when we update a dynamic array or mapping
        emit OnePieceRaceEnter(msg.sender);
    }

    // This is the function that the Chainlink Keeper nodes call
    // They look for the `upkeepNeeded` to return true. 

    function checkUpkeep(bytes memory /*checkData*/)public override
    returns (bool upkeepNeeded, bytes memory /* performData */ ) {
        bool isOpen = (TreasureState.OPEN == s_treasureState);
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval); 
        bool hasPlayers = (s_players.length > 0);
        bool hasBalance = (address(this).balance > 0);
        upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
        
     }

    function performUpkeep(bytes calldata /* performData */) external override{
        (bool upkeepNeeded, ) = checkUpkeep("");
        if(!upkeepNeeded){
            revert OnePiece__UpkeepNotNeeded(
                address(this).balance, 
                s_players.length, 
                uint256(s_treasureState)
            );
        }
        s_treasureState = TreasureState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        emit RequestedOnePieceFinder(requestId);
    }

    function fulfillRandomWords(uint256 /*requestId*/, uint256[] memory randomWords) internal override {
        uint256 finderIndex = randomWords[0] % s_players.length;
        address payable recentFinder = s_players[finderIndex];        
        s_recentFinder = recentFinder;

        s_treasureState = TreasureState.OPEN;
        s_players = new address payable[](0);
        s_lastTimeStamp = block.timestamp;

       (bool callSuccess, ) = recentFinder.call{value: address(this).balance}("");
        //require(callSuccess, "Call Failed");
        if(!callSuccess){
            revert OnePiece__TransferFailed();
        }        
        emit FinderPicked(recentFinder);
    }

    // View functions
    function getEntranceFee () public view returns (uint256){
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns (address){
        return s_players[index];
    }

    function getRecentFinder() public view returns(address){
        return s_recentFinder;
    }

    function getTreasureState() public view returns (TreasureState){
        return s_treasureState;
    }

    function getNumWords() public pure returns (uint256){
        return NUM_WORDS;
    }

    function getNumOfPlayers() public view returns (uint256){
        return s_players.length;
    }
    
    function getLatestTimeStamp() public view returns (uint256){
        return s_lastTimeStamp;
    }

    function getRequestConfirmations() public pure returns (uint256){
        return REQUEST_CONFIRMATIONS;
    }
}