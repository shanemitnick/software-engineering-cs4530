import { nanoid } from 'nanoid';
import { mock, mockDeep, mockReset } from 'jest-mock-extended';
import { Socket } from 'socket.io';
import TwilioVideo from './TwilioVideo';
import Player from '../types/Player';
import CoveyTownController from './CoveyTownController';
import CoveyTownListener from '../types/CoveyTownListener';
import { UserLocation } from '../CoveyTypes';
import PlayerSession from '../types/PlayerSession';
import { townSubscriptionHandler } from '../requestHandlers/CoveyTownRequestHandlers';
import CoveyTownsStore from './CoveyTownsStore';
import * as TestUtils from '../client/TestUtils';
import { ServerConversationArea } from '../client/TownsServiceClient';

const mockTwilioVideo = mockDeep<TwilioVideo>();
jest.spyOn(TwilioVideo, 'getInstance').mockReturnValue(mockTwilioVideo);

function generateTestLocation(): UserLocation {
  return {
    rotation: 'back',
    moving: Math.random() < 0.5,
    x: Math.floor(Math.random() * 100),
    y: Math.floor(Math.random() * 100),
  };
}

describe('CoveyTownController', () => {
  beforeEach(() => {
    mockTwilioVideo.getTokenForTown.mockClear();
  });
  it('constructor should set the friendlyName property', () => {
    const townName = `FriendlyNameTest-${nanoid()}`;
    const townController = new CoveyTownController(townName, false);
    expect(townController.friendlyName).toBe(townName);
  });
  describe('addPlayer', () => {
    it('should use the coveyTownID and player ID properties when requesting a video token', async () => {
      const townName = `FriendlyNameTest-${nanoid()}`;
      const townController = new CoveyTownController(townName, false);
      const newPlayerSession = await townController.addPlayer(new Player(nanoid()));
      expect(mockTwilioVideo.getTokenForTown).toBeCalledTimes(1);
      expect(mockTwilioVideo.getTokenForTown).toBeCalledWith(
        townController.coveyTownID,
        newPlayerSession.player.id,
      );
    });
  });
  describe('town listeners and events', () => {
    let testingTown: CoveyTownController;
    const mockListeners = [
      mock<CoveyTownListener>(),
      mock<CoveyTownListener>(),
      mock<CoveyTownListener>(),
    ];
    beforeEach(() => {
      const townName = `town listeners and events tests ${nanoid()}`;
      testingTown = new CoveyTownController(townName, false);
      mockListeners.forEach(mockReset);
    });
    it('should notify added listeners of player movement when updatePlayerLocation is called', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);
      const newLocation = generateTestLocation();
      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      testingTown.updatePlayerLocation(player, newLocation);
      mockListeners.forEach(listener => expect(listener.onPlayerMoved).toBeCalledWith(player));
    });
    it('should notify added listeners of player disconnections when destroySession is called', async () => {
      const player = new Player('test player');
      const session = await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      testingTown.destroySession(session);
      mockListeners.forEach(listener =>
        expect(listener.onPlayerDisconnected).toBeCalledWith(player),
      );
    });
    it('should notify added listeners of new players when addPlayer is called', async () => {
      mockListeners.forEach(listener => testingTown.addTownListener(listener));

      const player = new Player('test player');
      await testingTown.addPlayer(player);
      mockListeners.forEach(listener => expect(listener.onPlayerJoined).toBeCalledWith(player));
    });
    it('should notify added listeners that the town is destroyed when disconnectAllPlayers is called', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      testingTown.disconnectAllPlayers();
      mockListeners.forEach(listener => expect(listener.onTownDestroyed).toBeCalled());
    });
    it('should not notify removed listeners of player movement when updatePlayerLocation is called', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const newLocation = generateTestLocation();
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      testingTown.updatePlayerLocation(player, newLocation);
      expect(listenerRemoved.onPlayerMoved).not.toBeCalled();
    });
    it('should not notify removed listeners of player disconnections when destroySession is called', async () => {
      const player = new Player('test player');
      const session = await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      testingTown.destroySession(session);
      expect(listenerRemoved.onPlayerDisconnected).not.toBeCalled();
    });
    it('should not notify removed listeners of new players when addPlayer is called', async () => {
      const player = new Player('test player');

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      const session = await testingTown.addPlayer(player);
      testingTown.destroySession(session);
      expect(listenerRemoved.onPlayerJoined).not.toBeCalled();
    });

    it('should not notify removed listeners that the town is destroyed when disconnectAllPlayers is called', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      testingTown.disconnectAllPlayers();
      expect(listenerRemoved.onTownDestroyed).not.toBeCalled();
    });
  });
  describe('townSubscriptionHandler', () => {
    const mockSocket = mock<Socket>();
    let testingTown: CoveyTownController;
    let player: Player;
    let session: PlayerSession;
    beforeEach(async () => {
      const townName = `connectPlayerSocket tests ${nanoid()}`;
      testingTown = CoveyTownsStore.getInstance().createTown(townName, false);
      mockReset(mockSocket);
      player = new Player('test player');
      session = await testingTown.addPlayer(player);
    });
    it('should reject connections with invalid town IDs by calling disconnect', async () => {
      TestUtils.setSessionTokenAndTownID(nanoid(), session.sessionToken, mockSocket);
      townSubscriptionHandler(mockSocket);
      expect(mockSocket.disconnect).toBeCalledWith(true);
    });
    it('should reject connections with invalid session tokens by calling disconnect', async () => {
      TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, nanoid(), mockSocket);
      townSubscriptionHandler(mockSocket);
      expect(mockSocket.disconnect).toBeCalledWith(true);
    });
    describe('with a valid session token', () => {
      it('should add a town listener, which should emit "newPlayer" to the socket when a player joins', async () => {
        TestUtils.setSessionTokenAndTownID(
          testingTown.coveyTownID,
          session.sessionToken,
          mockSocket,
        );
        townSubscriptionHandler(mockSocket);
        await testingTown.addPlayer(player);
        expect(mockSocket.emit).toBeCalledWith('newPlayer', player);
      });
      it('should add a town listener, which should emit "playerMoved" to the socket when a player moves', async () => {
        TestUtils.setSessionTokenAndTownID(
          testingTown.coveyTownID,
          session.sessionToken,
          mockSocket,
        );
        townSubscriptionHandler(mockSocket);
        testingTown.updatePlayerLocation(player, generateTestLocation());
        expect(mockSocket.emit).toBeCalledWith('playerMoved', player);
      });
      it('should add a town listener, which should emit "playerDisconnect" to the socket when a player disconnects', async () => {
        TestUtils.setSessionTokenAndTownID(
          testingTown.coveyTownID,
          session.sessionToken,
          mockSocket,
        );
        townSubscriptionHandler(mockSocket);
        testingTown.destroySession(session);
        expect(mockSocket.emit).toBeCalledWith('playerDisconnect', player);
      });
      it('should add a town listener, which should emit "townClosing" to the socket and disconnect it when disconnectAllPlayers is called', async () => {
        TestUtils.setSessionTokenAndTownID(
          testingTown.coveyTownID,
          session.sessionToken,
          mockSocket,
        );
        townSubscriptionHandler(mockSocket);
        testingTown.disconnectAllPlayers();
        expect(mockSocket.emit).toBeCalledWith('townClosing');
        expect(mockSocket.disconnect).toBeCalledWith(true);
      });
      describe('when a socket disconnect event is fired', () => {
        it('should remove the town listener for that socket, and stop sending events to it', async () => {
          TestUtils.setSessionTokenAndTownID(
            testingTown.coveyTownID,
            session.sessionToken,
            mockSocket,
          );
          townSubscriptionHandler(mockSocket);

          // find the 'disconnect' event handler for the socket, which should have been registered after the socket was connected
          const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect');
          if (disconnectHandler && disconnectHandler[1]) {
            disconnectHandler[1]();
            const newPlayer = new Player('should not be notified');
            await testingTown.addPlayer(newPlayer);
            expect(mockSocket.emit).not.toHaveBeenCalledWith('newPlayer', newPlayer);
          } else {
            fail('No disconnect handler registered');
          }
        });
        it('should destroy the session corresponding to that socket', async () => {
          TestUtils.setSessionTokenAndTownID(
            testingTown.coveyTownID,
            session.sessionToken,
            mockSocket,
          );
          townSubscriptionHandler(mockSocket);

          // find the 'disconnect' event handler for the socket, which should have been registered after the socket was connected
          const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect');
          if (disconnectHandler && disconnectHandler[1]) {
            disconnectHandler[1]();
            mockReset(mockSocket);
            TestUtils.setSessionTokenAndTownID(
              testingTown.coveyTownID,
              session.sessionToken,
              mockSocket,
            );
            townSubscriptionHandler(mockSocket);
            expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
          } else {
            fail('No disconnect handler registered');
          }
        });
      });
      it('should forward playerMovement events from the socket to subscribed listeners', async () => {
        TestUtils.setSessionTokenAndTownID(
          testingTown.coveyTownID,
          session.sessionToken,
          mockSocket,
        );
        townSubscriptionHandler(mockSocket);
        const mockListener = mock<CoveyTownListener>();
        testingTown.addTownListener(mockListener);
        // find the 'playerMovement' event handler for the socket, which should have been registered after the socket was connected
        const playerMovementHandler = mockSocket.on.mock.calls.find(
          call => call[0] === 'playerMovement',
        );
        if (playerMovementHandler && playerMovementHandler[1]) {
          const newLocation = generateTestLocation();
          player.location = newLocation;
          playerMovementHandler[1](newLocation);
          expect(mockListener.onPlayerMoved).toHaveBeenCalledWith(player);
        } else {
          fail('No playerMovement handler registered');
        }
      });
    });
  });
  describe('addConversationArea', () => {
    let testingTown: CoveyTownController;
    beforeEach(() => {
      const townName = `addConversationArea test town ${nanoid()}`;
      testingTown = new CoveyTownController(townName, false);
    });
    it('should add the conversation area to the list of conversation areas', () => {
      const newConversationArea = TestUtils.createConversationForTesting();
      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);
      const areas = testingTown.conversationAreas;
      expect(areas.length).toEqual(1);
      expect(areas[0].label).toEqual(newConversationArea.label);
      expect(areas[0].topic).toEqual(newConversationArea.topic);
      expect(areas[0].boundingBox).toEqual(newConversationArea.boundingBox);
    });

    it('should not add a conversation area if they are overlapping', () => {
      const firstConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 15, y: 15, height: 10, width: 10 },
      });
      const secondConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 20, y: 20, height: 5, width: 5 },
      });

      const addAreaOne = testingTown.addConversationArea(firstConversationArea);
      expect(addAreaOne).toBeTruthy();

      const addAreaTwo = testingTown.addConversationArea(secondConversationArea);
      expect(addAreaTwo).toBeFalsy();
    });

    it('should add a converasation area if they share a on the side', () => {
      const firstConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 15, y: 15, height: 10, width: 10 },
      });
      const secondConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 25, y: 15, height: 10, width: 10 },
      });

      const addAreaOne = testingTown.addConversationArea(firstConversationArea);
      expect(addAreaOne).toBeTruthy();

      const addAreaTwo = testingTown.addConversationArea(secondConversationArea);
      expect(addAreaTwo).toBeTruthy();
    });

    it('should add a converasation area if they share a on the top/bottom', () => {
      const firstConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 15, y: 15, height: 10, width: 10 },
      });
      const secondConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 15, y: 25, height: 10, width: 10 },
      });

      const addAreaOne = testingTown.addConversationArea(firstConversationArea);
      expect(addAreaOne).toBeTruthy();

      const addAreaTwo = testingTown.addConversationArea(secondConversationArea);
      expect(addAreaTwo).toBeTruthy();
    });

    it('should not add conversation area if they have the same label', () => {
      const firstConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 15, y: 15, height: 10, width: 10 },
      });
      const secondConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 30, y: 30, height: 5, width: 5 },
      });
      firstConversationArea.label = 'test';
      secondConversationArea.label = 'test';

      const addAreaOne = testingTown.addConversationArea(firstConversationArea);
      expect(addAreaOne).toBeTruthy();

      const addAreaTwo = testingTown.addConversationArea(secondConversationArea);
      expect(addAreaTwo).toBeFalsy();
    });

    it('should return false if the topic is empty', () => {
      const firstConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 15, y: 15, height: 10, width: 10 },
      });

      firstConversationArea.topic = '';
      const result = testingTown.addConversationArea(firstConversationArea);
      expect(result).toBeFalsy();
    });
  });
  describe('updatePlayerLocation', () => {
    let testingTown: CoveyTownController;
    beforeEach(() => {
      const townName = `updatePlayerLocation test town ${nanoid()}`;
      testingTown = new CoveyTownController(townName, false);
    });

    it('if the previous and current conversation area are not equal, a change should be made', async () => {
      const firstConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 15, y: 15, height: 10, width: 10 },
      });
      const secondConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 30, y: 30, height: 5, width: 5 },
      });
      let result = testingTown.addConversationArea(firstConversationArea);
      expect(result).toBe(true);
      result = testingTown.addConversationArea(secondConversationArea);
      expect(result).toBe(true);

      const player1 = new Player(nanoid());
      await testingTown.addPlayer(player1);

      const mockListener = mock<CoveyTownListener>();
      testingTown.addTownListener(mockListener);

      const userLocationInsideFirstCA: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 15,
        y: 15,
        conversationLabel: firstConversationArea.label,
      };

      const userLocationInsideSecondCA: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 30,
        y: 30,
        conversationLabel: secondConversationArea.label,
      };

      expect(result).toBe(true);
      testingTown.updatePlayerLocation(player1, userLocationInsideFirstCA);
      expect(firstConversationArea.occupantsByID.length).toEqual(1);
      expect(secondConversationArea.occupantsByID.length).toEqual(0);

      testingTown.updatePlayerLocation(player1, userLocationInsideSecondCA);
      expect(firstConversationArea.occupantsByID.length).toEqual(0);
      expect(secondConversationArea.occupantsByID.length).toEqual(1);
    });

    it('should not remove player conversation area if the new and old conversation area is the same', async () => {
      const newConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 15, y: 15, height: 10, width: 10 },
      });
      const player1 = new Player(nanoid());

      await testingTown.addPlayer(player1);

      const mockListener = mock<CoveyTownListener>();
      testingTown.addTownListener(mockListener);

      const userLocationInsideCA: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 15,
        y: 15,
        conversationLabel: newConversationArea.label,
      };

      const userLocationStillInsideCA: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 17,
        y: 17,
        conversationLabel: newConversationArea.label,
      };

      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);
      testingTown.updatePlayerLocation(player1, userLocationInsideCA);
      expect(newConversationArea.occupantsByID.length).toEqual(1);

      testingTown.updatePlayerLocation(player1, userLocationStillInsideCA);
      expect(newConversationArea.occupantsByID.length).toEqual(1);
      expect(mockListener.onConversationAreaDestroyed).toBeCalledTimes(0);
    });

    it('make sure the right player is removed from the area.', async () => {
      const newConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 15, y: 15, height: 10, width: 10 },
      });
      const player1 = new Player(nanoid());
      const player2 = new Player(nanoid());

      await testingTown.addPlayer(player1);
      await testingTown.addPlayer(player2);

      const mockListener = mock<CoveyTownListener>();
      testingTown.addTownListener(mockListener);

      const userLocationInsideCA: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 15,
        y: 15,
        conversationLabel: newConversationArea.label,
      };

      const userLocationOutsideCA: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 25,
        y: 25,
      };

      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);
      testingTown.updatePlayerLocation(player1, userLocationInsideCA);
      testingTown.updatePlayerLocation(player2, userLocationInsideCA);
      expect(newConversationArea.occupantsByID.length).toEqual(2);

      testingTown.updatePlayerLocation(player1, userLocationOutsideCA);
      expect(newConversationArea.occupantsByID.length).toEqual(1);
      expect(mockListener.onConversationAreaDestroyed).toBeCalledTimes(0);
    });

    it('if there are 2 players in a CA , and 1 leaves, it should emit a destroyedArea signal', async () => {
      const newConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 15, y: 15, height: 10, width: 10 },
      });
      const player1 = new Player(nanoid());
      const player2 = new Player(nanoid());

      await testingTown.addPlayer(player1);
      await testingTown.addPlayer(player2);

      const mockListener = mock<CoveyTownListener>();
      testingTown.addTownListener(mockListener);

      const userLocationInsideCA: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 15,
        y: 15,
        conversationLabel: newConversationArea.label,
      };

      const userLocationOutsideCA: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 25,
        y: 25,
      };

      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);
      testingTown.updatePlayerLocation(player1, userLocationInsideCA);
      testingTown.updatePlayerLocation(player2, userLocationInsideCA);
      expect(newConversationArea.occupantsByID.length).toEqual(2);

      testingTown.updatePlayerLocation(player1, userLocationOutsideCA);
      expect(newConversationArea.occupantsByID.length).toEqual(1);
      expect(mockListener.onConversationAreaDestroyed).toBeCalledTimes(0);
    });

    it('a player should be removed from occupant list if they leave', async () => {
      const newConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 15, y: 15, height: 10, width: 10 },
      });
      const player1 = new Player(nanoid());
      await testingTown.addPlayer(player1);

      const mockListener = mock<CoveyTownListener>();
      testingTown.addTownListener(mockListener);

      const userLocationInsideCA: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 15,
        y: 15,
        conversationLabel: newConversationArea.label,
      };

      const userLocationOutsideCA: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 25,
        y: 25,
      };

      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);
      testingTown.updatePlayerLocation(player1, userLocationInsideCA);
      expect(newConversationArea.occupantsByID.length).toEqual(1);

      testingTown.updatePlayerLocation(player1, userLocationOutsideCA);
      expect(newConversationArea.occupantsByID.length).toEqual(0);
      expect(mockListener.onConversationAreaDestroyed).toBeCalledTimes(1);
    });

    it('should add player to conversation area when they enter', async () => {
      const newConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 15, y: 15, height: 10, width: 10 },
      });
      const player = new Player(nanoid());
      await testingTown.addPlayer(player);

      const userLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 11,
        y: 11,
        conversationLabel: newConversationArea.label,
      };

      player.location = userLocation;

      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);
      expect(newConversationArea.occupantsByID.length).toEqual(1);
      expect(player.activeConversationArea).toEqual(newConversationArea);
    });

    it('should not add a player to a conversation area if they are on the bottom left corner', async () => {
      const newConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 15, y: 15, height: 10, width: 10 },
      });
      const player1 = new Player(nanoid());
      await testingTown.addPlayer(player1);

      const userLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 10,
        y: 10,
      };

      player1.location = userLocation;

      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);
      expect(newConversationArea.occupantsByID.length).toEqual(0);
      expect(player1.activeConversationArea).toBeUndefined();
    });

    it('should not add a player to a conversation area if they are on the  left side', async () => {
      const newConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 15, y: 15, height: 10, width: 10 },
      });
      const player1 = new Player(nanoid());
      await testingTown.addPlayer(player1);

      const userLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 10,
        y: 15,
      };

      player1.location = userLocation;

      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);
      expect(newConversationArea.occupantsByID.length).toEqual(0);
      expect(player1.activeConversationArea).toBeUndefined();
    });

    it('should not add a player to a conversation area if they are on the  top left corner', async () => {
      const newConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 15, y: 15, height: 10, width: 10 },
      });
      const player1 = new Player(nanoid());
      await testingTown.addPlayer(player1);

      const userLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 10,
        y: 20,
      };

      player1.location = userLocation;

      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);
      expect(newConversationArea.occupantsByID.length).toEqual(0);
      expect(player1.activeConversationArea).toBeUndefined();
    });

    it('should not add a player to a conversation area if they are on the  top side', async () => {
      const newConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 15, y: 15, height: 10, width: 10 },
      });
      const player1 = new Player(nanoid());
      await testingTown.addPlayer(player1);

      const userLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 15,
        y: 20,
      };

      player1.location = userLocation;

      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);
      expect(newConversationArea.occupantsByID.length).toEqual(0);
      expect(player1.activeConversationArea).toBeUndefined();
    });

    it('should not add a player to a conversation area if they are on the  top right corner', async () => {
      const newConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 15, y: 15, height: 10, width: 10 },
      });
      const player1 = new Player(nanoid());
      await testingTown.addPlayer(player1);

      const userLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 20,
        y: 20,
      };

      player1.location = userLocation;

      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);
      expect(newConversationArea.occupantsByID.length).toEqual(0);
      expect(player1.activeConversationArea).toBeUndefined();
    });

    it('should not add a player to a conversation area if they are on the  right side', async () => {
      const newConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 15, y: 15, height: 10, width: 10 },
      });
      const player1 = new Player(nanoid());
      await testingTown.addPlayer(player1);

      const userLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 20,
        y: 15,
      };

      player1.location = userLocation;

      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);
      expect(newConversationArea.occupantsByID.length).toEqual(0);
      expect(player1.activeConversationArea).toBeUndefined();
    });

    it('should not add a player to a conversation area if they are on the  bottom right corner', async () => {
      const newConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 15, y: 15, height: 10, width: 10 },
      });
      const player1 = new Player(nanoid());
      await testingTown.addPlayer(player1);

      const userLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 20,
        y: 10,
      };

      player1.location = userLocation;

      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);
      expect(newConversationArea.occupantsByID.length).toEqual(0);
      expect(player1.activeConversationArea).toBeUndefined();
    });

    it('should not add a player to a conversation area if they are on the  bottom side', async () => {
      const newConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 15, y: 15, height: 10, width: 10 },
      });
      const player1 = new Player(nanoid());
      await testingTown.addPlayer(player1);

      const userLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 15,
        y: 10,
      };

      player1.location = userLocation;

      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);
      expect(newConversationArea.occupantsByID.length).toEqual(0);
      expect(player1.activeConversationArea).toBeUndefined();
    });

    it("should respect the conversation area reported by the player userLocation.conversationLabel, and not override it based on the player's x,y location", async () => {
      const newConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 10, y: 10, height: 5, width: 5 },
      });
      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);
      const player = new Player(nanoid());
      await testingTown.addPlayer(player);

      const newLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 25,
        y: 25,
        conversationLabel: newConversationArea.label,
      };
      testingTown.updatePlayerLocation(player, newLocation);
      expect(player.activeConversationArea?.label).toEqual(newConversationArea.label);
      expect(player.activeConversationArea?.topic).toEqual(newConversationArea.topic);
      expect(player.activeConversationArea?.boundingBox).toEqual(newConversationArea.boundingBox);

      const areas = testingTown.conversationAreas;
      expect(areas[0].occupantsByID.length).toBe(1);
      expect(areas[0].occupantsByID[0]).toBe(player.id);
    });
    it('should emit an onConversationUpdated event when a conversation area gets a new occupant', async () => {
      const newConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 10, y: 10, height: 5, width: 5 },
      });
      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);

      const mockListener = mock<CoveyTownListener>();
      testingTown.addTownListener(mockListener);

      const player = new Player(nanoid());
      await testingTown.addPlayer(player);
      const newLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 25,
        y: 25,
        conversationLabel: newConversationArea.label,
      };
      testingTown.updatePlayerLocation(player, newLocation);
      expect(mockListener.onConversationAreaUpdated).toHaveBeenCalledTimes(1);
    });

    it('should remove playerID from ConversationArea when a player disconnects', async () => {
      const newConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 10, y: 10, height: 5, width: 5 },
      });
      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);

      const mockListener = mock<CoveyTownListener>();
      testingTown.addTownListener(mockListener);

      const newLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 10,
        y: 10,
        conversationLabel: newConversationArea.label,
      };
      const player = new Player(nanoid());
      const session = await testingTown.addPlayer(player);
      testingTown.updatePlayerLocation(player, newLocation);
      expect(mockListener.onConversationAreaUpdated).toHaveBeenCalledTimes(1);

      expect(newConversationArea.occupantsByID).toStrictEqual([player.id]);
      await testingTown.destroySession(session);
      expect(newConversationArea.occupantsByID).toStrictEqual([]);
    });

    it('should add player to conversation area when they enter', async () => {
      const newConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 10, y: 10, height: 5, width: 5 },
      });
      testingTown.addConversationArea(newConversationArea);
      const mockListener = mock<CoveyTownListener>();
      testingTown.addTownListener(mockListener);

      const oldLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 0,
        y: 0,
      };

      const player = new Player(nanoid());
      await testingTown.addPlayer(player);
      testingTown.updatePlayerLocation(player, oldLocation);
      expect(mockListener.onConversationAreaUpdated).toHaveBeenCalledTimes(0);

      const newLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 10,
        y: 10,
        conversationLabel: newConversationArea.label,
      };

      testingTown.updatePlayerLocation(player, newLocation);
      expect(newConversationArea.occupantsByID.length).toBe(1);
      expect(mockListener.onConversationAreaUpdated).toHaveBeenCalledTimes(1);
    });

    describe('testing movement', () => {
      let townName: string;
      let testTown: CoveyTownController;
      let player: Player;
      let newLocation: UserLocation;
      let newConversationArea: ServerConversationArea;
      let mockListener = mock<CoveyTownListener>();

      beforeEach(async () => {
        townName = `updatePlayerLocation test town ${nanoid()}`;
        testTown = new CoveyTownController(townName, false);

        newConversationArea = TestUtils.createConversationForTesting({
          boundingBox: { x: 10, y: 10, height: 5, width: 5 },
        });

        player = new Player(nanoid());
        mockListener = mock<CoveyTownListener>();
        testTown.addTownListener(mockListener);
        await testTown.addPlayer(player);
        testTown.addConversationArea(newConversationArea);

        newLocation = {
          moving: false,
          rotation: 'front',
          x: 10,
          y: 10,
          conversationLabel: newConversationArea.label,
        };
      });

      it('should only update conversation area if previous and current areas are not equal', async () => {
        const oldLocation: UserLocation = {
          moving: false,
          rotation: 'front',
          x: 30,
          y: 30,
          conversationLabel: newConversationArea.label,
        };

        await testTown.updatePlayerLocation(player, newLocation);
        await testTown.updatePlayerLocation(player, oldLocation);

        expect(player.location.conversationLabel).toBeDefined();
        expect(player.location === oldLocation).toBeTruthy();
      });

      it('should emit onPlayerMoved for every movement.', async () => {
        const mockListenerOne = mock<CoveyTownListener>();
        testTown.addTownListener(mockListenerOne);

        testTown.addPlayer(player);
        await testTown.updatePlayerLocation(player, newLocation);

        const newDirection: UserLocation = {
          moving: false,
          rotation: 'right',
          x: 11,
          y: 10,
          conversationLabel: newConversationArea.label,
        };

        await testTown.updatePlayerLocation(player, newDirection);
        expect(mockListenerOne.onPlayerMoved).toBeCalledTimes(2);
      });

      it('check rotate player to the left', async () => {
        testTown.addPlayer(player);
        await testTown.updatePlayerLocation(player, newLocation);
        expect(player.location.rotation).toBe('front');

        const newDirection: UserLocation = {
          moving: false,
          rotation: 'left',
          x: 10,
          y: 10,
          conversationLabel: newConversationArea.label,
        };

        await testTown.updatePlayerLocation(player, newDirection);
        expect(player.location.rotation).toBe('left');
      });

      it('check rotate player to the right', async () => {
        testTown.addPlayer(player);
        await testTown.updatePlayerLocation(player, newLocation);
        expect(player.location.rotation).toBe('front');

        const newDirection: UserLocation = {
          moving: false,
          rotation: 'right',
          x: 10,
          y: 10,
          conversationLabel: newConversationArea.label,
        };

        await testTown.updatePlayerLocation(player, newDirection);
        expect(player.location.rotation).toBe('right');
      });

      it('check rotate player to the back', async () => {
        testTown.addPlayer(player);
        await testTown.updatePlayerLocation(player, newLocation);
        expect(player.location.rotation).toBe('front');

        const newDirection: UserLocation = {
          moving: false,
          rotation: 'back',
          x: 10,
          y: 10,
          conversationLabel: newConversationArea.label,
        };

        await testTown.updatePlayerLocation(player, newDirection);
        expect(player.location.rotation).toBe('back');
      });

      it('check rotate player staying front', async () => {
        testTown.addPlayer(player);
        await testTown.updatePlayerLocation(player, newLocation);
        expect(player.location.rotation).toBe('front');

        const newDirection: UserLocation = {
          moving: false,
          rotation: 'front',
          x: 10,
          y: 10,
          conversationLabel: newConversationArea.label,
        };

        await testTown.updatePlayerLocation(player, newDirection);
        expect(player.location.rotation).toBe('front');
      });
    });
  });

  describe('removePlayerFromCA', () => {
    let testingTown: CoveyTownController;
    beforeEach(() => {
      const townName = `updatePlayerLocation test town ${nanoid()}`;
      testingTown = new CoveyTownController(townName, false);
    });

    it('make sure the right player is removed from the area.', async () => {
      const newConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 15, y: 15, height: 10, width: 10 },
      });
      const player1 = new Player(nanoid());
      const player2 = new Player(nanoid());

      await testingTown.addPlayer(player1);
      await testingTown.addPlayer(player2);

      const mockListener = mock<CoveyTownListener>();
      testingTown.addTownListener(mockListener);

      const userLocationInsideCA: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 15,
        y: 15,
        conversationLabel: newConversationArea.label,
      };

      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);
      testingTown.updatePlayerLocation(player1, userLocationInsideCA);
      testingTown.updatePlayerLocation(player2, userLocationInsideCA);

      expect(newConversationArea.occupantsByID.length).toEqual(2);

      testingTown.removePlayerFromConversationArea(player1, newConversationArea);
      expect(newConversationArea.occupantsByID).toStrictEqual([player2.id]);
    });

    it('trying to remove player taht isnt in the CA should result in no change.', async () => {
      const newConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 15, y: 15, height: 10, width: 10 },
      });
      const player1 = new Player(nanoid());
      const player2 = new Player(nanoid());
      const player3 = new Player(nanoid());

      await testingTown.addPlayer(player1);
      await testingTown.addPlayer(player2);

      const mockListener = mock<CoveyTownListener>();
      testingTown.addTownListener(mockListener);

      const userLocationInsideCA: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 15,
        y: 15,
        conversationLabel: newConversationArea.label,
      };

      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);
      testingTown.updatePlayerLocation(player1, userLocationInsideCA);
      testingTown.updatePlayerLocation(player2, userLocationInsideCA);
      testingTown.updatePlayerLocation(player3, userLocationInsideCA);

      expect(newConversationArea.occupantsByID.length).toEqual(3);

      testingTown.removePlayerFromConversationArea(player2, newConversationArea);

      expect(newConversationArea.occupantsByID).toStrictEqual([player1.id, player3.id]);
    });
  });
});
