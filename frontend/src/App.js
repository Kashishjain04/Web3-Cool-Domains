import React, { useEffect, useState } from "react";
import "./styles/App.css";
import detectEthereumProvider from "@metamask/detect-provider";
import * as ethers from "ethers";
import abi from "./assets/Domains.json";
import polygonLogo from "./assets/polygonlogo.png";
import ethLogo from "./assets/ethlogo.png";
import { networks } from "./utils/networks";

const tld = ".dev";
const contractAddress = process.env.REACT_APP_CONTRACT_ADDRESS;
const contractABI = abi.abi;

const App = () => {
	const [currentAccount, setCurrentAccount] = useState(""),
		[mints, setMints] = useState([]),
		[domain, setDomain] = useState(""),
		[record, setRecord] = useState(""),
		[network, setNetwork] = useState(""),
		[editing, setEditing] = useState(false),
		[loading, setLoading] = useState(false);

	const switchNetwork = async (ethereum) => {
		const networkData = [
			{
				chainId: "0x13881",
				chainName: "Polygon Mumbai Testnet",
				rpcUrls: ["https://rpc-mumbai.maticvigil.com/"],
				nativeCurrency: {
					name: "Mumbai Matic",
					symbol: "MATIC",
					decimals: 18,
				},
				blockExplorerUrls: ["https://mumbai.polygonscan.com"],
			},
		];
		try {
			await ethereum.request({
				method: "wallet_addEthereumChain",
				params: networkData,
			});
			return true;
		} catch (error) {
			console.log(error);
			return false;
		}
	};

	const getEthereumObject = async () => {
		const ethereum = await detectEthereumProvider();
		if (!ethereum || !ethereum.isMetaMask) {
			return { error: "Metamask Not Installed.", errorCode: 1, ethereum };
		}
		const chainId = await ethereum.request({ method: "eth_chainId" });
		setNetwork(networks[chainId]);
		// if (chainId !== "0x80001" && chainId !== "0x13881") {
		// const switched = await switchNetwork(ethereum);
		// if (!switched) return { error: "Connected to different network", errorCode: 2, ethereum };
		// }
		return { ethereum };
	};

	const switchToPolygon = async () => {
		const { ethereum } = await getEthereumObject();
		if (ethereum) await switchNetwork(ethereum);
	};

	const checkIfConnected = async () => {
		const ethereum = await getEthereumObject();
		setLoading(true);
		if (ethereum.error) {
			if (ethereum.errorCode === 1) {
				setLoading(false);
				return alert(ethereum.error);
			}
			// if (ethereum.errorCode === 2) {
			// 	const switched = await switchNetwork(ethereum.ethereum);
			// 	if (!switched) {
			// 		return alert("Failed to change current network.");
			// 	}
			// }
		}
		const accounts = await ethereum.ethereum.request({ method: "eth_accounts" });
		if (accounts.length === 0) {
			setLoading(false);
			return console.log("No authorized account found.");
		}
		setCurrentAccount(accounts[0]);
		setLoading(false);
		ethereum.ethereum.on("chainChanged", handleChainChanged);
		// Reload the page when they change networks
		function handleChainChanged(_chainId) {
			window.location.reload();
		}
	};

	const connectWallet = async () => {
		try {
			const { ethereum, error, errorCode } = await getEthereumObject();
			if (errorCode === 1) {
				return alert(error);
			}
			// if (errorCode === 2) {
			// 	const switched = await switchNetwork(ethereum);
			// 	if (!switched) return console.log("Network switch request rejected.");
			// }
			setLoading(true);
			const accounts = await ethereum.request({ method: "eth_requestAccounts" });
			setCurrentAccount(accounts[0]);
			setLoading(false);
		} catch (error) {
			console.log(error);
		}
	};

	const mintDomain = async () => {
		if (!domain) return alert("Invalid domain");
		if (domain.length < 3) return alert("Domain too short.");
		setLoading(true);
		const price = domain.length === 3 ? "0.05" : domain.length === 4 ? "0.03" : "0.01";
		try {
			const { ethereum, error } = await getEthereumObject();
			if (error) return alert(error);
			const provider = new ethers.providers.Web3Provider(ethereum);
			const signer = provider.getSigner();
			const contract = new ethers.Contract(contractAddress, contractABI, signer);
			// pop wallet to pay gas fee
			let txn = await contract.register(domain, { value: ethers.utils.parseEther(price) });
			const receipt = await txn.wait();
			if (receipt.status === 1) {
				// Set the record for the domain
				if(record){
					txn = await contract.setRecord(domain, record);
					await txn.wait();
				}
				console.log("Domain minted! https://mumbai.polygonscan.com/tx/" + txn.hash);
				// Call fetchMints after 2 seconds
				setTimeout(() => {
					fetchMints();
				}, 2000);

				setRecord("");
				setDomain("");
			} else {
				return alert("Transaction failed! Please try again");
			}
		} catch (error) {
			console.log(error);
		} finally {
			setLoading(false);
		}
	};

	const fetchMints = async () => {
		setLoading(true);
		try {
			const { ethereum } = await getEthereumObject();
			if (ethereum) {
				const provider = new ethers.providers.Web3Provider(ethereum);
				const signer = provider.getSigner();
				const contract = new ethers.Contract(contractAddress, contractABI, signer);
				const names = await contract.getAllNames();
				const mintRecords = await Promise.all(
					names.map(async (name, id) => {
						const record = await contract.records(name);
						const owner = await contract.domains(name);
						return {
							id,
							name,
							record,
							owner,
						};
					})
				);
				setMints(mintRecords);
			}
		} catch (error) {
			console.log(error);
		} finally {
			setLoading(false);
		}
	};

	const updateDomain = async () => {
		if (!domain || !record) return;
		setLoading(true);
		try {
			const { ethereum } = await getEthereumObject();
			if (ethereum) {
				const provider = new ethers.providers.Web3Provider(ethereum);
				const signer = provider.getSigner();
				const contract = new ethers.Contract(contractAddress, contractABI, signer);
				let txn = await contract.setRecord(domain, record);
				await txn.wait();
				console.log("Domain updated: https://mumbai.polygonscan.com/tx/" + txn.hash);
				// fetchMints();
				setDomain("");
				setRecord("");
			}
		} catch (error) {
			console.log(error);
		} finally {
			setLoading(false);
		}
	};

	const editRecord = (name) => {
		setEditing(true);
		setDomain(name);
	};

	useEffect(() => {
		checkIfConnected();
		//eslint-disable-next-line
	}, []);
	useEffect(() => {
		if (network === "Polygon Mumbai Testnet") {
			fetchMints();
		}
		//eslint-disable-next-line
	}, [currentAccount, network]);

	const renderNotConnectedContainer = () => {
		if (!currentAccount)
			return (
				<div className="connect-wallet-container">
					<img
						src="https://user-images.githubusercontent.com/55389276/140866485-8fb1c876-9a8f-4d6a-98dc-08c4981eaf70.gif"
						alt="Ninja gif"
					/>
					<button onClick={connectWallet} className="cta-button connect-wallet-button">
						Connect Wallet
					</button>
				</div>
			);
	};

	const renderInputForm = () => {
		if (network !== "Polygon Mumbai Testnet") {
			return (
				<div className="connect-wallet-container">
					<h2>Please switch to Polygon Mumbai Testnet</h2>
					{/* This button will call our switch network function */}
					<button className="cta-button mint-button" onClick={switchToPolygon}>
						Click here to switch
					</button>
				</div>
			);
		}
		return (
			<div className="form-container">
				<div className="first-row">
					<input
						type="text"
						value={domain}
						placeholder="domain"
						onChange={(e) => setDomain(e.target.value)}
					/>
					<p className="tld"> {tld} </p>
				</div>

				<input
					type="text"
					value={record}
					placeholder="what's ur development power"
					onChange={(e) => setRecord(e.target.value)}
				/>

				{editing ? (
					<div className="button-container">
						<button className="cta-button mint-button" disabled={loading} onClick={updateDomain}>
							Set record
						</button>
						<button
							className="cta-button mint-button"
							onClick={() => {
								setEditing(false);
							}}
						>
							Cancel
						</button>
					</div>
				) : (
					<button className="cta-button mint-button" disabled={loading} onClick={mintDomain}>
						Mint
					</button>
				)}
			</div>
		);
	};

	const renderMints = () => {
		if (currentAccount && mints.length > 0) {
			return (
				<div className="mint-container">
					<p className="subtitle"> Recently minted domains!</p>
					<div className="mint-list">
						{mints.map((mint, index) => {
							return (
								<div className="mint-item" key={index}>
									<div className="mint-row">
										<a
											className="link"
											href={`https://testnets.opensea.io/assets/mumbai/${contractAddress}/${mint.id}`}
											target="_blank"
											rel="noopener noreferrer"
										>
											<p className="underlined">
												{" "}
												{mint.name}
												{tld}{" "}
											</p>
										</a>
										{/* If mint.owner is currentAccount, add an "edit" button*/}
										{mint.owner.toLowerCase() === currentAccount.toLowerCase() ? (
											<button
												className="edit-button"
												onClick={() => editRecord(mint.name)}
											>
												<img
													className="edit-icon"
													src="https://img.icons8.com/metro/26/000000/pencil.png"
													alt="Edit button"
												/>
											</button>
										) : null}
									</div>
									<p> {mint.record} </p>
								</div>
							);
						})}
					</div>
				</div>
			);
		}
	};

	return (
		<div className="App">
			<div className="container">
				<div className="header-container">
					<header>
						<div className="left">
							<p className="title">👨‍💻 Dev Name Service - DNS</p>
							<p className="subtitle">Your immortal API on the blockchain!</p>
						</div>
						<div className="right">
							<img
								alt="Network logo"
								className="logo"
								src={network?.includes("Polygon") ? polygonLogo : ethLogo}
							/>
							{currentAccount ? (
								<p>
									{" "}
									Wallet: {currentAccount.slice(0, 6)}...{currentAccount.slice(-4)}{" "}
								</p>
							) : (
								<p> Not connected </p>
							)}
						</div>
					</header>
				</div>

				{!currentAccount && renderNotConnectedContainer()}
				{currentAccount && renderInputForm()}
				{mints && renderMints()}
			</div>
		</div>
	);
};

export default App;
