import { customAlphabet, nanoid } from 'nanoid';
import { BoundingBox, ServerConversationArea } from '../client/TownsServiceClient';
import { UserLocation } from '../CoveyTypes';
import CoveyTownListener from '../types/CoveyTownListener';
import Player from '../types/Player';
import PlayerSession from '../types/PlayerSession';
import IVideoClient from './IVideoClient';
import TwilioVideo from './TwilioVideo';

const friendlyNanoID = customAlphabet('1234567890ABCDEF', 8);

/**
 * The CoveyTownController implements the logic for each town: managing the various events that
 * can occur (e.g. joining a town, moving, leaving a town)
 */
export default class CoveyTownController {
  get capacity(): number {
    return this._capacity;
  }

  set isPubliclyListed(value: boolean) {
    this._isPubliclyListed = value;
  }

  get isPubliclyListed(): boolean {
    return this._isPubliclyListed;
  }

  get townUpdatePassword(): string {
    return this._townUpdatePassword;
  }

  get players(): Player[] {
    return this._players;
  }

  get occupancy(): number {
    return this._listeners.length;
  }

  get friendlyName(): string {
    return this._friendlyName;
  }

  set friendlyName(value: string) {
    this._friendlyName = value;
  }

  get coveyTownID(): string {
    return this._coveyTownID;
  }

  get conversationAreas(): ServerConversationArea[] {
    return this._conversationAreas;
  }

  /** The list of players currently in the town * */
  private _players: Player[] = [];

  /** The list of valid sessions for this town * */
  private _sessions: PlayerSession[] = [];

  /** The videoClient that this CoveyTown will use to provision video resources * */
  private _videoClient: IVideoClient = TwilioVideo.getInstance();

  /** The list of CoveyTownListeners that are subscribed to events in this town * */
  private _listeners: CoveyTownListener[] = [];

  /** The list of currently active ConversationAreas in this town */
  private _conversationAreas: ServerConversationArea[] = [];

  private readonly _coveyTownID: string;

  private _friendlyName: string;

  private readonly _townUpdatePassword: string;

  private _isPubliclyListed: boolean;

  private _capacity: number;

  constructor(friendlyName: string, isPubliclyListed: boolean) {
    this._coveyTownID = process.env.DEMO_TOWN_ID === friendlyName ? friendlyName : friendlyNanoID();
    this._capacity = 50;
    this._townUpdatePassword = nanoid(24);
    this._isPubliclyListed = isPubliclyListed;
    this._friendlyName = friendlyName;
  }

  /**
   * Adds a player to this Covey Town, provisioning the necessary credentials for the
   * player, and returning them
   *
   * @param newPlayer The new player to add to the town
   */
  async addPlayer(newPlayer: Player): Promise<PlayerSession> {
    const theSession = new PlayerSession(newPlayer);

    this._sessions.push(theSession);
    this._players.push(newPlayer);

    // Create a video token for this user to join this town
    theSession.videoToken = await this._videoClient.getTokenForTown(
      this._coveyTownID,
      newPlayer.id,
    );

    // Notify other players that this player has joined
    this._listeners.forEach(listener => listener.onPlayerJoined(newPlayer));

    return theSession;
  }

  /**
   * Destroys all data related to a player in this town.
   *
   * @param session PlayerSession to destroy
   */
  destroySession(session: PlayerSession): void {
    this._players = this._players.filter(p => p.id !== session.player.id);
    this._sessions = this._sessions.filter(s => s.sessionToken !== session.sessionToken);
    this._listeners.forEach(listener => listener.onPlayerDisconnected(session.player));

    // TODO: need to remove this user from any conversation areas.
    // again, send out a onConversationAreaUpdated
  }

  /**
   * Updates the location of a player within the town
   *
   * If the player has changed conversation areas, this method also updates the
   * corresponding ConversationArea objects tracked by the town controller, and dispatches
   * any onConversationUpdated events as appropriate
   *
   * @param player Player to update location for
   * @param location New location for this player
   */
  updatePlayerLocation(player: Player, location: UserLocation): void {
    player.updateLocation(location);
    this._listeners.forEach(listener => listener.onPlayerMoved(player));

    // TODO: need to check if a users new location is now outside or now inside of any conversationArea
    // if they are in a conversation area and now no longer are, send that messge
    // if they are now in a new conversation area, update that
    // send a "onConversationAreaUpdated event" and include exit or enter
  }

  /**
   * This determines if 2 boxes overlap. Returns True if they overlap, false if not.
   * @param box1
   * @param box2
   * @returns boolean based on if the boxes overlap or not
   */
  public static boxOverlap(box1: BoundingBox, box2: BoundingBox): boolean {
    const box1XMax = box1.x + box1.width / 2;
    const box1XMin = box1.x - box1.width / 2;
    const box1YMax = box1.y + box1.height / 2;
    const box1YMin = box1.y - box1.height / 2;

    const box2XMax = box2.x + box2.width / 2;
    const box2XMin = box2.x - box2.width / 2;
    const box2YMax = box2.y + box2.height / 2;
    const box2YMin = box2.y - box2.height / 2;

    // console.log(box1XMax > box2XMin);
    // console.log(box2XMax > box1XMin);
    // console.log([box2XMax, box1XMin]);
    // console.log(box1YMax > box2YMin);
    // console.log(box2YMax > box1YMin);
    return box1XMax > box2XMin && box2XMax > box1XMin && box1YMax > box2YMin && box2YMax > box1YMin;
  }

  /**
   * Helper function to help with notifying all listeners a new conversation area has been created.
   * @param area
   */
  notifyListeners(area: ServerConversationArea): void {
    this._listeners.forEach(listener => {
      listener.onConversationAreaUpdated(area);
    });
  }

  addPlayersToConversationArea(area: ServerConversationArea): void {
    // function to check if the player is in the conversation are given in parent function.
    function playerInArea(player: Player): boolean {
      const boxXMax = area.boundingBox.x + area.boundingBox.width / 2;
      const boxXMin = area.boundingBox.x - area.boundingBox.width / 2;
      const boxYMax = area.boundingBox.y + area.boundingBox.height / 2;
      const boxYMin = area.boundingBox.y - area.boundingBox.height / 2;

      const { x, y } = player.location;

      return x > boxXMin && x < boxXMax && y > boxYMin && y < boxYMax;
    }

    this._players.forEach(p => {
      if (playerInArea(p)) {
        p.setConversationArea(area);
        area.occupantsByID.push(p.id);
      }
    });
  }

  /**
   * Checks to see if this boundingBox overlaps with any of the already exisisting bounding
   * boxes in the world.
   *
   * @param boundingBox Bounding box looking to be added.
   * @returns True if there is overlap, False if there is no overlap
   */
  checkOverlappingBoxes(boundingBox: BoundingBox): boolean {
    const overlappingCheck = (element: ServerConversationArea) => {
      const elementBox = element.boundingBox;

      return CoveyTownController.boxOverlap(boundingBox, elementBox);
    };

    const boxOverlapping = this.conversationAreas.some(overlappingCheck);

    return boxOverlapping;
  }

  /**
   * Creates a new conversation area in this town if there is not currently an active
   * conversation with the same label.
   *
   * Adds any players who are in the region defined by the conversation area to it.
   *
   * Notifies any CoveyTownListeners that the conversation has been updated
   *
   * @param _conversationArea Information describing the conversation area to create. Ignores any
   *  occupantsById that are set on the conversation area that is passed to this method.
   *
   * @returns true if the conversation is successfully created, or false if not
   */
  addConversationArea(_conversationArea: ServerConversationArea): boolean {
    // check if topic name exists
    const cAExists = this._conversationAreas.some(ca => ca.label === _conversationArea.label);
    const cAOverlapping = this.checkOverlappingBoxes(_conversationArea.boundingBox);

    if (_conversationArea.topic && !cAExists && !cAOverlapping) {
      this._conversationAreas.push(_conversationArea);

      // add players to area
      this.addPlayersToConversationArea(_conversationArea);

      // notify all listeners of a new conversation area.
      this.notifyListeners(_conversationArea);
      return true;
    }
    return false;

    return this._capacity > 0 && _conversationArea.label !== ''; // TODO delete this when you implement HW2, it is here just to satisfy the linter
  }

  /**
   * Subscribe to events from this town. Callers should make sure to
   * unsubscribe when they no longer want those events by calling removeTownListener
   *
   * @param listener New listener
   */
  addTownListener(listener: CoveyTownListener): void {
    this._listeners.push(listener);
  }

  /**
   * Unsubscribe from events in this town.
   *
   * @param listener The listener to unsubscribe, must be a listener that was registered
   * with addTownListener, or otherwise will be a no-op
   */
  removeTownListener(listener: CoveyTownListener): void {
    this._listeners = this._listeners.filter(v => v !== listener);
  }

  /**
   * Fetch a player's session based on the provided session token. Returns undefined if the
   * session token is not valid.
   *
   * @param token
   */
  getSessionByToken(token: string): PlayerSession | undefined {
    return this._sessions.find(p => p.sessionToken === token);
  }

  disconnectAllPlayers(): void {
    this._listeners.forEach(listener => listener.onTownDestroyed());
  }
}
