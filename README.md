# Solana NFT Dutch Auction

This project will run a Dutch style auction for NFT Mints on Solana. A Dutch auction is one where the price starts high and lowers every x minutes.

To get started, first run `yarn install` in the ~/metaplex/js and ~/metaplex/js/packages/candy-machine-ui folders. Then, from inside candy-machine-ui, run `yarn start` to start up the UI for the mint.

The way the project works is by calling a script to update the candy machine state every x minutes (x being how often we want the price to drop). Because updating the
candy machine is an RPC call, it will take variable time, usually around 20-30 seconds. I call the update function 22 seconds before the countdown expires. If the countdown hits 0 before the actual price updates, the UI will automatically show "Price is updating..." to let the user know to not mint yet because the price is still updating. After the candy machine updates to the correct price, the countdown to the next price drop will automatically show up and the decreased price will show up.

In order to change the settings for the mint (specifically the start date), you will need to go into the config.json file in the top level of the directory (solana-dapp-react-template). The `goLiveDate` attribute refers to the start date of the NFT mint. This date will need to match the datetime on line 19 in dutch_candy_machine_update.py.

To run the mint, have the UI up (with yarn start from ./~/metaplex/js/packages/candy-machine-ui) and then run the dutch_candy_machine_update.py script anytime before the start date of the mint.

This repository clones both the Metaplex candy machine v2 repository and this repository: https://github.com/caitsithlord/solana-dapp-react-template which adds the TailwindCSS and Zustand classes.

If you have any questions about the project, please feel free to email me at chessegg@gmail.com.  Happy minting!
