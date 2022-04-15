function updateCMPrice() {
  //   var objShell = new ActiveXObject('shell.application');
  //   objShell.ShellExecute(
  //     'cmd.exe',
  //     'C: ts-node ~/metaplex/js/packages/cli/src/candy-machine-v2-cli.ts update_candy_machine -e devnet -k ~/.config/solana/devnet.json -cp config.json -c example',
  //     'C:\\Users\\cxh170004\\Documents\\New NFT Website Test\\solana-dapp-react-template',
  //     'open',
  //     '1',
  //   );

  //   var shell = WScript.CreateObject('WScript.Shell');
  //   shell.Run('echo hi');
  var objShell = new ActiveXObject('WSCRIPT.Shell').Run('dir');
}

updateCMPrice();
