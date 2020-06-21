import React, { Fragment, useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import socketIOClient from "socket.io-client";
import "./App.css";
const ENDPOINT = "https://0m2q7.sse.codesandbox.io/";
const socket = socketIOClient(ENDPOINT);

var getURLParameter = function (url, key) {
	var searchString = "?" + url.split("?")[1];
	if (searchString === undefined) {
		return null;
	}
	var escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
	var regex = new RegExp("[?|&]" + escapedKey + "=" + "([^&]*)(&|$)");
	var match = regex.exec(searchString);
	if (match === null) {
		return null;
	}
	return decodeURIComponent(match[1]);
};

const App = props => {
	const [sessionData, setSessionData] = useState(null);
	const [sessionId, setSessionId] = useState(null);
	const [playing, isPlaying] = useState(false);
	const [url, setUrl] = useState(false);
	const [qr, setQr] = useState(false);
	const videoRef = useRef();

	useEffect(() => {}, []);

	useEffect(() => {
		if (sessionId) {
			socket.on("updateSession", response => {
				console.log("Socket on updateSession", response);
				setSessionData(response);
			});
		}
	}, []);

	play = () => {
		videoRef.current.play();
		isPlaying(true);
	};
	pause = () => {
		videoRef.current.pause();
		isPlaying(false);
	};

	disconnect = () => {
		socket.emit("leaveSession", {}, () => {
			console.log("Left session");
			setSessionData(null);
			setSessionId(null);
			setQr(null);
			setUrl(null);
		});
	};

	updateSession = () => {
		socket.emit(
			"updateSession",
			{ ...sessionData, state: playing ? "playing" : "paused" },
			() => {
				console.log("emitting data");
			}
		);
	};

	return (
		<div>
			<div className="dummy-video-player">
				<video
					ref={videoRef}
					src={require("./assets/cc.mp4")}
					autoPlay={false}
					controls={true}
					style={{ width: 600, height: 400 }}
				/>
				<p>
					<button
						className="playback-button"
						onClick={() => (playing ? pause() : play())}
						aria-label={playing ? "Pause" : "Play"}
					>
						{playing ? "Pause" : "Play"}
					</button>
				</p>
			</div>
			<div className="app">
				<div className="no-error">
					{!sessionId && (
						<div className="disconnected">
							<h2>Create a Watcho Party</h2>
							<p>
								{/* <label>
								<input type="checkbox" id="control-lock" /> Only I have control
							</label> */}
							</p>
							<p>
								<button id="create-session" type="button" onClick={e => createSession()}>
									Start the party
								</button>
							</p>
						</div>
					)}
					{sessionId && (
						<div className="connected ">
							<p>
								Scan the QR code or Share the URL below so others can join the party. The
								recipient(s) should navigate to this URL and{" "}
								<strong>then click on the Watcho Party icon</strong> to join.
							</p>
							<p>
								<img src={qr} alt={url} />
							</p>
							<input
								id="share-url"
								type="text"
								readonly="true"
								autocomplete="off"
								autofocus
								value={url}
							/>
							<p className="copy-val">
								<small>
									<a href="#" id="copy-btn" onClick={e => copyUrl()}>
										Copy URL
									</a>
								</small>
							</p>
							{/* <p>
					<label>
						<input type="checkbox" id="show-chat" /> Show chat
					</label>
				</p> */}
							<p>
								<button
									id="leave-session"
									type="button"
									onClick={() => {
										disconnect();
									}}
								>
									Disconnect
								</button>
							</p>
						</div>
					)}
					{/* <div className="some-error ">
			<p id="error-msg" className="error"></p>
			<p>
				<button id="close-error" type="button" onClick={e => close()}>
					Dismiss
				</button>
			</p>
		</div> */}
				</div>
				<div className="display"></div>
			</div>
		</div>
	);
};
