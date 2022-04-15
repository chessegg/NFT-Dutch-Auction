import os
import json
import time
from datetime import datetime

# now = datetime.now()
# print(f'month is {now.month} and day is {now.day} and hour is {now.hour} and minute is {now.minute} and second is {now.second}')

with open('config.json') as config:
    data = json.load(config)

curPrice = data['price']
# print(f'curPrice is {curPrice} and the type is {type(curPrice)}')
startAuction = False

while True:
    now = datetime.now()
    if now.month == 4 and now.day == 15 and now.hour == 2 and now.minute == 0 and now.second == 0:
        startAuction = True
        break

if startAuction:
    while curPrice > 1.01: #BEWARE OF ROUNDING ERRORS HERE, IF THE ENDING PRICE IS 1 SOL, MAKE THIS NUMBER LIKE 1.01 SOL AT LEAST
        #It takes 20-30 seconds to update the candy machine so time.sleep(40) would run approximately every minute, but not exactly.
        #Because we wanted something more accurate so the time increments don't get messed up, we use the datetime library again. 
        now = datetime.now()
        if (now.hour == 2) and now.second == 38: 
            curPrice -= 1
            data['price'] = curPrice
            with open ('config.json', 'w') as outfile:
                json.dump(data, outfile)

            try:
                stream = os.popen('ts-node ~/metaplex/js/packages/cli/src/candy-machine-v2-cli.ts update_candy_machine -e devnet -k ~/.config/solana/devnet.json -cp config.json -c example')
                output = stream.read()
                print('output is', output)
                while 'UnhandledPromiseRejectionWarning' in output: #random error, service unavailable, just rerun
                    stream = os.popen('ts-node ~/metaplex/js/packages/cli/src/candy-machine-v2-cli.ts update_candy_machine -e devnet -k ~/.config/solana/devnet.json -cp config.json -c example')
                    output = stream.read()
            except Exception as e:
                print('exception is', e)
            continue

    
