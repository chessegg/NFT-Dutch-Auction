import { useEffect, useMemo, useState, useRef } from 'react';
import * as anchor from '@project-serum/anchor';

import styled from 'styled-components';
import { Container, Snackbar } from '@material-ui/core';
import Paper from '@material-ui/core/Paper';
import Alert from '@material-ui/lab/Alert';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import { Authorized, PublicKey, Transaction } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletDialogButton } from '@solana/wallet-adapter-material-ui';
import {
  awaitTransactionSignatureConfirmation,
  CandyMachineAccount,
  CANDY_MACHINE_PROGRAM,
  getCandyMachineState,
  mintOneToken,
} from './candy-machine';
import { AlertState, toDate, formatNumber, getAtaForMint } from './utils';
import { MintCountdown, DutchCountdown } from './MintCountdown';
import { MintButton } from './MintButton';
import { GatewayProvider } from '@civic/solana-gateway-react';
import { sendTransaction } from './connection';
import Atrix_logo from './Atrix.png';
import {
  NFT_0,
  NFT_1,
  NFT_2,
  NFT_3,
  NFT_4,
  NFT_5,
  NFT_6,
  NFT_7,
  NFT_8,
  NFT_9,
} from './nft-pngs';
import { EventEmitter } from 'stream';
import { start } from 'repl';
import { time } from 'console';

const ConnectButton = styled(WalletDialogButton)`
  width: 100%;
  height: 60px;
  margin-top: 10px;
  margin-bottom: 5px;
  background: linear-gradient(180deg, #604ae5 0%, #813eee 100%);
  color: white;
  font-size: 16px;
  font-weight: bold;
`;

const MintContainer = styled.div``; // add your owns styles here

export interface HomeProps {
  candyMachineId?: anchor.web3.PublicKey;
  connection: anchor.web3.Connection;
  txTimeout: number;
  rpcHost: string;
}

const Home = (props: HomeProps) => {
  const [isUserMinting, setIsUserMinting] = useState(false);
  const [candyMachine, setCandyMachine] = useState<CandyMachineAccount>();
  const [alertState, setAlertState] = useState<AlertState>({
    open: false,
    message: '',
    severity: undefined,
  });
  const [isActive, setIsActive] = useState(false);
  const [endDate, setEndDate] = useState<Date>();
  const [itemsRemaining, setItemsRemaining] = useState<number>();
  const [isWhitelistUser, setIsWhitelistUser] = useState(false);
  const [isPresale, setIsPresale] = useState(false);
  const [discountPrice, setDiscountPrice] = useState<anchor.BN>();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [nextDiscountTime, setNextDiscountTime] = useState<Date>();
  const SOL_STARTING_PRICE = 10;
  const NUM_TOTAL_NFTS = 10;
  const PRICE_DECREMENT_AMT = 1; //drop price 1 sol after every time increment
  const [nextDiscountPrice, setNextDiscountPrice] = useState(
    SOL_STARTING_PRICE - PRICE_DECREMENT_AMT,
  );
  const componentKeyToIncrement = useRef(0);
  const wallet = useWallet();
  const rpcUrl = props.rpcHost;
  const DUTCH_INTERVAL_MINS = 1;

  const nftArray = [
    NFT_0,
    NFT_1,
    NFT_2,
    NFT_3,
    NFT_4,
    NFT_5,
    NFT_6,
    NFT_7,
    NFT_8,
    NFT_9,
  ];

  let myArray: Array<any> = [];
  for (let i = 0; i < NUM_TOTAL_NFTS; i++) {
    myArray.push({
      number: i,
      title: 'NFT ' + i.toString(),
      image: nftArray[i],
    });
  }

  console.log(myArray);

  useEffect(() => {
    console.log('getting called from use effect');
    refreshCandyMachineState();
    calcNextPriceDrop();
  }, [wallet.publicKey, candyMachine?.id]); //when it first runs, wallet might not be connected, so need to run again when it knows public key (ie wallet connected)

  useEffect(() => {
    //not in the useEffect above otherwise calcNextPriceDrop() would be called twice when countdown hits 0
    console.log('refreshing machine state because countdown timer hit 0');
    refreshCandyMachineState();
  }, [componentKeyToIncrement.current]);

  console.log('wallet outside useMemo here is', wallet);
  console.log('next discount time is', nextDiscountTime);
  console.log(
    'cur candy machine price is',
    formatNumber.asNumber(candyMachine?.state.price),
  );
  console.log('next discount price is', nextDiscountPrice);

  const calcNextPriceDrop = async () => {
    console.log('inside calc next price fxn');
    if (candyMachine && candyMachine.state.goLiveDate) {
      let numIntervalsPassed;
      const curDate = new Date();
      console.log('cur date is', curDate);
      var diff =
        curDate.getTime() - toDate(candyMachine!.state.goLiveDate)!.getTime();
      if (diff < 0) {
        numIntervalsPassed = 0;
      } else {
        //console.log(Math.floor(diff / (60000 * DUTCH_INTERVAL_MINS)));
        numIntervalsPassed = Math.floor(diff / (60000 * DUTCH_INTERVAL_MINS)); //60000 ms in a minute
        //***FOR 10 MINUTE INTERVALS, ADD CURDATE.GETMINUTES() === 9 TO THE CHECK BELOW***
        if (curDate.getSeconds() === 59) {
          //to account for this fxn sometimes getting called 1 second before the current nextDiscountTime
          console.log('inside setting new discount time');
          numIntervalsPassed += 1;
        }
      }
      console.log(
        'num intervals passed from within calc fxn is',
        numIntervalsPassed,
      );
      //setNextDiscountPrice(SOL_STARTING_PRICE - numIntervalsPassed - PRICE_DECREMENT_AMT);
      if (numIntervalsPassed === 0) {
        //console.log('calculating first price drop time');
        //console.log(toDate(candyMachine?.state.goLiveDate));
        const goLive: Date = toDate(candyMachine.state.goLiveDate)!;
        goLive.setMinutes(goLive.getMinutes() + DUTCH_INTERVAL_MINS);
        setNextDiscountTime(goLive);
        setNextDiscountPrice(SOL_STARTING_PRICE - PRICE_DECREMENT_AMT);
      } else {
        if (numIntervalsPassed < 10) {
          //console.log('calculating next price drop time');
          if (numIntervalsPassed === 9) {
            //so that when price is updating from 2 to 1 after countdown, it still shows price updating screen (triggered by candyMachine price - nextDiscountPrice = 2)
            setNextDiscountPrice(0);
          } else {
            const discountTime: Date = toDate(candyMachine.state.goLiveDate)!;
            discountTime.setMinutes(
              discountTime.getMinutes() +
                DUTCH_INTERVAL_MINS * numIntervalsPassed +
                1,
            );
            setNextDiscountTime(discountTime);
            setNextDiscountPrice(
              SOL_STARTING_PRICE - numIntervalsPassed - PRICE_DECREMENT_AMT,
            );
            //console.log('next price drop time set to', discountTime);
          }
        } else {
          numIntervalsPassed = -1;
        }
      }
    }
    //refreshCandyMachineState();
  };

  const anchorWallet = useMemo(() => {
    console.log('wallet is', wallet);
    if (
      !wallet ||
      !wallet.publicKey ||
      !wallet.signAllTransactions ||
      !wallet.signTransaction
    ) {
      console.log('Wallet Not Connected Error');
      if (!wallet) {
        console.log('no wallet');
      }
      if (!wallet.publicKey) {
        console.log('no wallet pubkey');
      }
      if (!wallet.signAllTransactions) {
        console.log('signAllTransactions failed');
      }
      if (!wallet.signTransaction) {
        console.log('signTransaction failed');
      }
      return;
    }

    return {
      publicKey: wallet.publicKey,
      signAllTransactions: wallet.signAllTransactions,
      signTransaction: wallet.signTransaction,
    } as anchor.Wallet;
  }, [wallet.publicKey]);
  console.log('anchor outside use effect', anchorWallet);

  const refreshCandyMachineState = async () => {
    console.log('inside refresh candy machine state fxn');
    if (!anchorWallet) {
      console.log('no anchor wallet');
      return;
    }
    if (props.candyMachineId) {
      try {
        const cndy = await getCandyMachineState(
          anchorWallet,
          props.candyMachineId,
          props.connection,
        );
        let active =
          cndy?.state.goLiveDate?.toNumber() < new Date().getTime() / 1000;
        let presale = false;
        // whitelist mint?
        if (cndy?.state.whitelistMintSettings) {
          // is it a presale mint?
          if (
            cndy.state.whitelistMintSettings.presale &&
            (!cndy.state.goLiveDate ||
              cndy.state.goLiveDate.toNumber() > new Date().getTime() / 1000)
          ) {
            presale = true;
          }
          // is there a discount?
          if (cndy.state.whitelistMintSettings.discountPrice) {
            setDiscountPrice(cndy.state.whitelistMintSettings.discountPrice);
          } else {
            setDiscountPrice(undefined);
            // when presale=false and discountPrice=null, mint is restricted
            // to whitelist users only
            if (!cndy.state.whitelistMintSettings.presale) {
              cndy.state.isWhitelistOnly = true;
            }
          }
          // retrieves the whitelist token
          const mint = new anchor.web3.PublicKey(
            cndy.state.whitelistMintSettings.mint,
          );
          const token = (await getAtaForMint(mint, anchorWallet.publicKey))[0];

          try {
            const balance = await props.connection.getTokenAccountBalance(
              token,
            );
            let valid = parseInt(balance.value.amount) > 0;
            // only whitelist the user if the balance > 0
            setIsWhitelistUser(valid);
            active = (presale && valid) || active;
          } catch (e) {
            setIsWhitelistUser(false);
            // no whitelist user, no mint
            if (cndy.state.isWhitelistOnly) {
              active = false;
            }
            console.log('Not a valid whitelist user');
            console.log(e);
          }
        }

        // datetime to stop the mint?
        if (cndy?.state.endSettings?.endSettingType.date) {
          setEndDate(toDate(cndy.state.endSettings.number));
          if (
            cndy.state.endSettings.number.toNumber() <
            new Date().getTime() / 1000
          ) {
            active = false;
          }
        }
        // amount to stop the mint?
        if (cndy?.state.endSettings?.endSettingType.amount) {
          console.log(
            'setting set items remaining inside of refresh candy machine fxn',
          );
          let limit = Math.min(
            cndy.state.endSettings.number.toNumber(),
            cndy.state.itemsAvailable,
          );
          if (cndy.state.itemsRedeemed < limit) {
            setItemsRemaining(limit - cndy.state.itemsRedeemed);
          } else {
            setItemsRemaining(0);
            cndy.state.isSoldOut = true;
          }
        } else {
          setItemsRemaining(cndy.state.itemsRemaining);
        }

        if (cndy.state.isSoldOut) {
          active = false;
        }

        setIsActive((cndy.state.isActive = active));
        setIsPresale((cndy.state.isPresale = presale));
        setCandyMachine(cndy);
        if (candyMachine && !isSubscribed) {
          candyMachine.program.account.candyMachine
            .subscribe(candyMachine.id)
            .on('change', account => {
              console.log('account is', account);
              if (!anchorWallet) return;
              console.log(
                'account.data.price is',
                formatNumber.asNumber(account.data.price),
              );
              console.log(
                'account.itemsRedeemed is',
                account.itemsRedeemed.toNumber(),
              );
              cndy.state.price = account.data.price;
              cndy.state.itemsAvailable =
                NUM_TOTAL_NFTS - account.itemsRedeemed.toNumber();
              setItemsRemaining(
                NUM_TOTAL_NFTS - account.itemsRedeemed.toNumber(),
              );
              setCandyMachine(cndy);
            });
          setIsSubscribed(true);
        }
      } catch (e) {
        if (e instanceof Error) {
          if (e.message === `Account does not exist ${props.candyMachineId}`) {
            setAlertState({
              open: true,
              message: `Couldn't fetch candy machine state from candy machine with address: ${props.candyMachineId}, using rpc: ${props.rpcHost}! You probably typed the REACT_APP_CANDY_MACHINE_ID value in wrong in your .env file, or you are using the wrong RPC!`,
              severity: 'error',
              noHide: true,
            });
          } else if (e.message.startsWith('failed to get info about account')) {
            setAlertState({
              open: true,
              message: `Couldn't fetch candy machine state with rpc: ${props.rpcHost}! This probably means you have an issue with the REACT_APP_SOLANA_RPC_HOST value in your .env file, or you are not using a custom RPC!`,
              severity: 'error',
              noHide: true,
            });
          }
        } else {
          setAlertState({
            open: true,
            message: `${e}`,
            severity: 'error',
            noHide: true,
          });
        }
        console.log(e);
      }
    } else {
      setAlertState({
        open: true,
        message: `Your REACT_APP_CANDY_MACHINE_ID value in the .env file doesn't look right! Make sure you enter it in as plain base-58 address!`,
        severity: 'error',
        noHide: true,
      });
    }
  };

  const onMint = async (
    beforeTransactions: Transaction[] = [],
    afterTransactions: Transaction[] = [],
  ) => {
    try {
      setIsUserMinting(true);
      document.getElementById('#identity')?.click();
      if (wallet.connected && candyMachine?.program && wallet.publicKey) {
        let mintOne = await mintOneToken(
          candyMachine,
          wallet.publicKey,
          beforeTransactions,
          afterTransactions,
        );
        console.log('after mint one token fxn');

        const mintTxId = mintOne[0];
        console.log('mint tx id', mintTxId);

        let status: any = { err: true };
        if (mintTxId) {
          status = await awaitTransactionSignatureConfirmation(
            mintTxId,
            props.txTimeout,
            props.connection,
            true,
          );
        }

        if (status && !status.err) {
          // manual update since the refresh might not detect
          // the change immediately
          console.log(
            'no status error, items currently remaining is',
            itemsRemaining,
          );
          let remaining = itemsRemaining! - 1;
          setItemsRemaining(remaining);
          setIsActive((candyMachine.state.isActive = remaining > 0));
          candyMachine.state.isSoldOut = remaining === 0;
          setAlertState({
            open: true,
            message: 'Congratulations! Mint succeeded!',
            severity: 'success',
          });
        } else {
          setAlertState({
            open: true,
            message: 'Mint failed! Please try again!',
            severity: 'error',
          });
        }
      }
    } catch (error: any) {
      let message = error.msg || 'Minting failed! Please try again!';
      if (!error.msg) {
        if (!error.message) {
          message = 'Transaction Timeout! Please try again.';
        } else if (error.message.indexOf('0x137')) {
          console.log(error);
          message = `SOLD OUT!`;
        } else if (error.message.indexOf('0x135')) {
          message = `Insufficient funds to mint. Please fund your wallet.`;
        }
      } else {
        if (error.code === 311) {
          console.log(error);
          message = `SOLD OUT!`;
          window.location.reload();
        } else if (error.code === 312) {
          message = `Minting period hasn't started yet.`;
        }
      }

      setAlertState({
        open: true,
        message,
        severity: 'error',
      });
      // updates the candy machine state to reflect the lastest
      // information on chain
      refreshCandyMachineState();
    } finally {
      setIsUserMinting(false);
      console.log('mint is finished');
    }
  };

  const toggleMintButton = () => {
    let active = !isActive || isPresale;

    if (active) {
      if (candyMachine!.state.isWhitelistOnly && !isWhitelistUser) {
        active = false;
      }
      if (endDate && Date.now() >= endDate.getTime()) {
        active = false;
      }
    }

    if (
      isPresale &&
      candyMachine!.state.goLiveDate &&
      candyMachine!.state.goLiveDate.toNumber() <= new Date().getTime() / 1000
    ) {
      setIsPresale((candyMachine!.state.isPresale = false));
    }

    setIsActive((candyMachine!.state.isActive = active));
  };

  return (
    <div>
      {/* <img
        src={Atrix_logo}
        height={60}
        width={200}
        style={{
          position: 'absolute',
          top: 20,
          //marginLeft: '15%',
        }}
        alt="Atrix logo"
      ></img> */}

      <Container style={{ marginTop: 100 }}>
        <Container maxWidth="sm" style={{ position: 'relative' }}>
          <Paper
            style={{
              padding: 24,
              paddingBottom: 10,
              backgroundColor: '#151A1F',
              borderRadius: 6,
            }}
          >
            {!wallet.connected ? (
              <ConnectButton>Connect Wallet</ConnectButton>
            ) : (
              <>
                {candyMachine && (
                  <Grid
                    container
                    direction="row"
                    justifyContent="center"
                    wrap="nowrap"
                  >
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        Remaining
                      </Typography>
                      <Typography
                        variant="h6"
                        color="textPrimary"
                        style={{
                          textAlign: 'center',
                          fontWeight: 'bold',
                        }}
                      >
                        {itemsRemaining}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        {isWhitelistUser && discountPrice
                          ? 'Discount Price'
                          : 'Price'}
                      </Typography>
                      <Typography
                        variant="h6"
                        color="textPrimary"
                        style={{ fontWeight: 'bold' }}
                      >
                        {isWhitelistUser && discountPrice
                          ? `◎ ${formatNumber.asNumber(discountPrice)}`
                          : `◎ ${formatNumber.asNumber(
                              candyMachine.state.price,
                            )}`}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} style={{ justifyContent: 'center' }}>
                      {!isActive || isPresale ? (
                        <>
                          <Typography variant="body2" color="textSecondary">
                            Auction Format
                          </Typography>
                          <Typography
                            variant="h6"
                            color="textPrimary"
                            style={{ fontWeight: 'bold' }}
                          >
                            <a
                              href="https://artblocks.wiki/Community/Dutch-Auction-Results"
                              target="_blank"
                              style={{ color: 'blue' }}
                            >
                              Dutch Auction
                            </a>
                          </Typography>
                        </>
                      ) : formatNumber.asNumber(candyMachine?.state.price) ===
                        1 ? (
                        <>
                          <Typography
                            variant="h6"
                            color="textPrimary"
                            style={{ textAlign: 'center', fontWeight: 'bold' }}
                          >
                            At Lowest Mint Price
                          </Typography>
                        </>
                      ) : formatNumber.asNumber(candyMachine?.state.price) ===
                        nextDiscountPrice + 2 * PRICE_DECREMENT_AMT ? (
                        //nextDiscountPrice will be 2 below current candy machine price after discount countdown but before candy machine updates
                        <>
                          <Typography
                            variant="h6"
                            color="textPrimary"
                            style={{ textAlign: 'center', fontWeight: 'bold' }}
                          >
                            Waiting for price update...
                          </Typography>
                        </>
                      ) : nextDiscountTime &&
                        new Date().getTime() < nextDiscountTime.getTime() ? (
                        <>
                          <DutchCountdown
                            key={componentKeyToIncrement.current}
                            date={nextDiscountTime}
                            style={{ justifyContent: 'center' }}
                            onComplete={() => {
                              calcNextPriceDrop();
                              componentKeyToIncrement.current =
                                componentKeyToIncrement.current + 1;
                            }}
                          />
                          <Typography
                            variant="caption"
                            align="center"
                            display="block"
                            style={{ textAlign: 'center', fontWeight: 'bold' }}
                          >
                            TO PRICE DROP
                          </Typography>
                        </>
                      ) : (
                        <>
                          <Typography
                            variant="h6"
                            color="textPrimary"
                            style={{ textAlign: 'center', fontWeight: 'bold' }}
                          >
                            Please Refresh Page
                          </Typography>
                        </>
                      )}
                    </Grid>
                    <Grid item xs={6}>
                      {isActive && endDate && Date.now() < endDate.getTime() ? (
                        <>
                          <MintCountdown
                            key="endSettings"
                            date={getCountdownDate(candyMachine)}
                            style={{ justifyContent: 'flex-end' }}
                            status="COMPLETED"
                            onComplete={toggleMintButton}
                          />
                          <Typography
                            variant="caption"
                            align="center"
                            display="block"
                            style={{ fontWeight: 'bold' }}
                          >
                            TO END OF MINT
                          </Typography>
                        </>
                      ) : (
                        <>
                          <MintCountdown
                            key="goLive"
                            date={getCountdownDate(candyMachine)}
                            style={{ justifyContent: 'flex-end' }}
                            status={
                              candyMachine?.state?.isSoldOut ||
                              (endDate && Date.now() > endDate.getTime())
                                ? 'COMPLETED'
                                : 'LIVE'
                            }
                            onComplete={() => {
                              toggleMintButton();
                              refreshCandyMachineState();
                            }}
                          />
                          {isPresale &&
                            candyMachine.state.goLiveDate &&
                            candyMachine.state.goLiveDate.toNumber() >
                              new Date().getTime() / 1000 && (
                              <Typography
                                variant="caption"
                                align="center"
                                display="block"
                                style={{ fontWeight: 'bold' }}
                              >
                                UNTIL PUBLIC MINT
                              </Typography>
                            )}
                        </>
                      )}
                    </Grid>
                  </Grid>
                )}
                <MintContainer>
                  {candyMachine?.state.isActive &&
                  candyMachine?.state.gatekeeper &&
                  wallet.publicKey &&
                  wallet.signTransaction ? (
                    <GatewayProvider
                      wallet={{
                        publicKey:
                          wallet.publicKey ||
                          new PublicKey(CANDY_MACHINE_PROGRAM),
                        //@ts-ignore
                        signTransaction: wallet.signTransaction,
                      }}
                      gatekeeperNetwork={
                        candyMachine?.state?.gatekeeper?.gatekeeperNetwork
                      }
                      clusterUrl={rpcUrl}
                      handleTransaction={async (transaction: Transaction) => {
                        setIsUserMinting(true);
                        const userMustSign = transaction.signatures.find(sig =>
                          sig.publicKey.equals(wallet.publicKey!),
                        );
                        if (userMustSign) {
                          setAlertState({
                            open: true,
                            message: 'Please sign one-time Civic Pass issuance',
                            severity: 'info',
                          });
                          try {
                            transaction = await wallet.signTransaction!(
                              transaction,
                            );
                          } catch (e) {
                            setAlertState({
                              open: true,
                              message: 'User cancelled signing',
                              severity: 'error',
                            });
                            // setTimeout(() => window.location.reload(), 2000);
                            setIsUserMinting(false);
                            throw e;
                          }
                        } else {
                          setAlertState({
                            open: true,
                            message: 'Refreshing Civic Pass',
                            severity: 'info',
                          });
                        }
                        try {
                          await sendTransaction(
                            props.connection,
                            wallet,
                            transaction,
                            [],
                            true,
                            'confirmed',
                          );
                          setAlertState({
                            open: true,
                            message: 'Please sign minting',
                            severity: 'info',
                          });
                        } catch (e) {
                          setAlertState({
                            open: true,
                            message:
                              'Solana dropped the transaction, please try again',
                            severity: 'warning',
                          });
                          console.error(e);
                          // setTimeout(() => window.location.reload(), 2000);
                          setIsUserMinting(false);
                          throw e;
                        }
                        await onMint();
                      }}
                      broadcastTransaction={false}
                      options={{ autoShowModal: false }}
                    >
                      <MintButton
                        candyMachine={candyMachine}
                        isMinting={isUserMinting}
                        setIsMinting={val => setIsUserMinting(val)}
                        onMint={onMint}
                        isActive={isActive || (isPresale && isWhitelistUser)}
                      />
                    </GatewayProvider>
                  ) : (
                    <MintButton
                      candyMachine={candyMachine}
                      isMinting={isUserMinting}
                      setIsMinting={val => setIsUserMinting(val)}
                      onMint={onMint}
                      isActive={isActive || (isPresale && isWhitelistUser)}
                    />
                  )}
                </MintContainer>
              </>
            )}
            <Typography
              variant="caption"
              align="center"
              display="block"
              style={{ marginTop: 7, color: 'grey', fontSize: 'medium' }}
            >
              {/* <a
                href="https://atrix.finance"
                target="_blank"
                style={{ color: 'blue' }}
              >
                Atrix
              </a> */}
            </Typography>
          </Paper>
        </Container>

        <Snackbar
          open={alertState.open}
          autoHideDuration={alertState.noHide ? null : 6000}
          onClose={() => setAlertState({ ...alertState, open: false })}
        >
          <Alert
            onClose={() => setAlertState({ ...alertState, open: false })}
            severity={alertState.severity}
          >
            {alertState.message}
          </Alert>
        </Snackbar>
      </Container>

      {/* <Grid
        container
        xs={true}
        sm={true}
        md={true}
        style={{
          //backgroundColor: 'red',
          color: 'white',
          marginTop: 70,
          textAlign: 'center',
        }}
        direction="row"
        justify-content="left"
        spacing={2}
        wrap="wrap"
      >
        {myArray.map((item, index) => (
          <Grid
            style={{
              width: 300,
              height: 300,
              //backgroundColor: 'blue',
            }}
            item
            xs={6}
            sm={4}
            md={2}
            key={index}
          >
            <img
              src={item.image}
              width={150}
              height={150}
              alt={item.title}
            ></img>
            <Typography variant="h6">{item.title}</Typography>
          </Grid>
        ))}
      </Grid> */}
    </div>
  );
};

const getCountdownDate = (
  candyMachine: CandyMachineAccount,
): Date | undefined => {
  if (
    candyMachine.state.isActive &&
    candyMachine.state.endSettings?.endSettingType.date
  ) {
    return toDate(candyMachine.state.endSettings.number);
  }

  return toDate(
    candyMachine.state.goLiveDate
      ? candyMachine.state.goLiveDate
      : candyMachine.state.isPresale
      ? new anchor.BN(new Date().getTime() / 1000)
      : undefined,
  );
};

export default Home;
