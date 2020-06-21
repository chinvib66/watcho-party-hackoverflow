import React, { Fragment, useState } from "react";
import "video-react/dist/video-react.css"; // import css
import QRCode from "qrcode";
import socketIOClient from "socket.io-client";
import { Player } from "video-react";

const ENDPOINT = process.env.SOCKET_ENDPOINT || "http://a8086de9040b.ngrok.io/"; //"https://0m2q7.sse.codesandbox.io/";
const socket = socketIOClient(ENDPOINT);

const CopyToClipboard = props => {
	const [copied, setCopied] = useState(false);
	const copy = () => {
		navigator.clipboard.writeText(props.text);
		setCopied(true);
		setTimeout(() => {
			setCopied(false);
		}, 3000);
	};

	return (
		<p className="copy-para">
			{props.text}
			<button style={{ marginBottom: 10 }} onClick={() => copy()}>
				Copy SessionId
			</button>
			{copied && "Copied"}
		</p>
	);
};

class App extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			expand: false,
			sessionId: null,
			videoId: window.location.pathname,
			sessionData: {
				videoId: window.location.pathname,
				sessionId: null,
			},
			loading: false,
			join: false,
			paused: true,
			player: null,
		};
		this.player = React.createRef();
	}

	// Component mounted
	componentDidMount() {
		this.player.subscribeToStateChange(this.handleStateChange.bind(this));
		this.setState({
			...this.state,
			player: this.player.getState(),
		});
		this.joinSession();
		socket.on("update", response => {
			console.log("Receiving update", response);
			this.setState({
				...this.state,
				sessionData: response,
				playing: response.state == "playing",
			});
			if (response.state == "playing") this.play();
			else this.pause();
			if (Math.abs(this.state.player.currentTime - response.currentTime) > 2)
				this.player.seek(response.currentTime);
		});
	}

	// Player Component state to App state map
	handleStateChange = playerState => {
		const { paused, player } = this.state;
		this.setState({ ...this.state, player: playerState, paused: playerState.paused });
		if (paused !== playerState.paused)
			this.updateSession({
				paused: playerState.paused,
				currentTime: playerState.currentTime,
			});
		if (Math.abs(player.currentTime - playerState.currentTime) > 2)
			this.updateSession({
				paused: playerState.paused,
				currentTime: playerState.currentTime,
			});
	};

	// Session Emitters
	createSession = () => {
		const videoId = this.state.videoId; //window.location.pathname;
		const updateState = state => {
			this.setState({ ...this.state, ...state });
		};
		if (socket.connected)
			socket.emit(
				"createSession",
				{
					controlLock: true, //$("#control-lock").is(":checked"),
					videoId: videoId,
					currentTime: this.state.player.currentTime,
				},
				function (response) {
					console.log("Created", response);

					if (response.errorMessage) {
						console.log(response.errorMessage, "Error");
						updateState({
							disabled: false,
							loading: false,
							join: false,
						});
					} else {
						let r = response.sessionId;
						let url = `${r}`;
						QRCode.toDataURL(url).then(uri => {
							updateState({
								qr: uri,
								disabled: false,
								url: url,
								sessionId: r,
								sessionData: {
									...response,
								},
							});
						});
					}
				}
			);
		else {
			updateState({
				disabled: false,
				loading: false,
				join: false,
				message: "Some error occured in connecting the server",
			});
			setTimeout(() => {
				updateState({ message: null });
			}, 3000);
		}
	};

	joinSession = async () => {
		var sid_from_url = this.state.partyId; //getURLParameter(window.location.href, "sessionId");
		var videoId = window.location.pathname;
		const updateState = state => {
			this.setState({ ...this.state, ...state });
		};

		if (sid_from_url) {
			if (socket.connected)
				socket.emit("joinSession", sid_from_url, response => {
					console.log("Joined", response);
					if (response.errorMessage) {
						console.log(response.errorMessage, "Error");
						updateState({
							disabled: false,
							loading: false,
							join: false,
						});
					} else {
						let r = sid_from_url;
						let url = `${r}`;
						QRCode.toDataURL(url).then(uri => {
							updateState({
								qr: uri,
								url: url,
								sessionId: r,
								join: false,
								sessionData: {
									...response,
								},
							});
						});
					}
				});
			else {
				updateState({
					disabled: false,
					loading: false,
					join: false,
					message: "Some error occured in connecting the server",
				});
				setTimeout(() => {
					updateState({ message: null });
				}, 3000);
			}
		} else {
			console.log("No session to join");
		}
	};

	updateSession = data => {
		const { paused, ...rest } = { ...data };
		if (socket.connected)
			socket.emit(
				"updateSession",
				{ ...this.state.sessionData, state: paused ? "paused" : "playing", ...rest },
				() => {
					console.log("Emitting data", {
						...this.state.sessionData,
						state: paused ? "paused" : "playing",
						...rest,
					});
				}
			);
		else {
			console.log("No Socket to emit to");
		}
	};

	play = () => {
		this.player.play();
	};
	pause = () => {
		this.player.pause();
	};

	seekby = seconds => {
		const { player } = this.player.getState();
		this.player.seek(player.currentTime + seconds);
	};

	disconnect = () => {
		socket.emit("leaveSession", {}, () => {
			console.log("Left session");
			this.setState({
				...this.state,
				sessionData: null,
				sessionId: null,
				qr: null,
				url: null,
				loading: false,
				disabled: false,
			});
		});
	};

	render() {
		return (
			<div>
				<div className="dummy-video-player">
					<div className="watcho-logo">
						<img src={require("./assets/watcho-logo-small.png")} />
					</div>
					<div style={{ width: 900 }}>
						<Player
							ref={player => {
								this.player = player;
							}}
						>
							<source src={require("./assets/cc.mp4")} />
						</Player>
					</div>
					<p>
						<button className="seek-button" onClick={() => this.seekby(-10)}>
							Seek -10 s
						</button>
						<button
							className="playback-button"
							onClick={() => (!this.state.paused ? this.pause() : this.play())}
							aria-label={!this.state.paused ? "Pause" : "Play"}
						>
							{!this.state.paused ? "Pause" : "Play"}
						</button>
						<button className="seek-button" onClick={() => this.seekby(10)}>
							Seek +10 s
						</button>
						<div></div>
					</p>
				</div>
				{!this.state.expand && (
					<buton
						onClick={e => {
							e.preventDefault();
							this.setState({ ...this.state, expand: true });
						}}
						className="expand-button"
					>
						{" "}
						Party!
					</buton>
				)}
				{this.state.expand && (
					<div className="app-watcho-party">
						<div
							className="close-button"
							style={{
								position: "absolute",
								top: 5,
								right: 15,
								fontSize: 16,
								cursor: "pointer",
							}}
							onClick={e => {
								e.preventDefault();
								this.setState({ ...this.state, expand: false });
							}}
						>
							x
						</div>
						<div className="no-error">
							{!this.state.sessionId && (
								<div className="disconnected">
									<h2>Watcho Party</h2>
									{this.state.loading && (
										<img src={require("./assets/loading.gif")} height={64} />
									)}
									{this.state.message && <p>{this.state.message}</p>}
									<p>
										<button
											id="create-session"
											type="button"
											style={{ margin: 5, minWidth: 100 }}
											disabled={this.state.disabled}
											onClick={e => {
												this.setState({
													...this.state,
													loading: true,
													disabled: true,
													join: false,
												});
												this.createSession();
											}}
										>
											Start party
										</button>

										<button
											style={{ margin: 5, minWidth: 100 }}
											id="create-session"
											type="button"
											disabled={this.state.disabled}
											onClick={e => {
												this.setState({ ...this.state, join: !this.state.join });
											}}
										>
											{this.state.join ? "Cancel" : "Join a Party"}
										</button>
									</p>
								</div>
							)}
							{this.state.join && (
								<form
									style={{
										display: "flex",
										flexDirection: "column",
										justifyContent: "center",
										alignItems: "center",
									}}
									onSubmit={e => {
										e.preventDefault();
										this.setState({ loading: true, disabled: true });
										this.joinSession();
									}}
								>
									<input
										id="share-url"
										type="text"
										autocomplete="off"
										autofocus
										placeholder="Enter Session Id"
										onChange={e =>
											this.setState({
												...this.state,
												partyId: e.target.value,
											})
										}
									/>
									<button type="submit">Join</button>
								</form>
							)}
							{this.state.sessionId && (
								<div className="connected ">
									<p>
										Scan the QR code or Share the Session ID below so others can join the
										party.
										<br />
										The recipient(s) should navigate to this video and{" "}
										<strong>then click on the Watcho Party icon</strong> to join.
									</p>
									<p>
										<img src={this.state.qr} alt={this.state.url} />
									</p>

									<CopyToClipboard text={this.state.url} />

									<p>
										<button
											id="leave-session"
											type="button"
											onClick={() => {
												this.disconnect();
											}}
										>
											Disconnect
										</button>
									</p>
								</div>
							)}
						</div>
						<div className="hide" style={{ textAlign: "center" }}>
							<hr />
							<button
								onClick={e => {
									e.preventDefault();
									this.setState({ ...this.state, expand: false });
								}}
							>
								Hide
							</button>
						</div>
					</div>
				)}
			</div>
		);
	}
}

export default App;
