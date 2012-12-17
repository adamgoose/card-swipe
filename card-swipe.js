var prime = require('prime');
var type = require('prime/util/type');
var array = require('prime/es5/array');
var fn = require('prime/es5/function');
var Keyboard = {};
array.combine = function(thisArray, thatArray){
    //var result = [];
    array.forEach(thatArray, function(value, key){
        thisArray.push(value);
    });
    //return result;
    return thisArray;
};
prime.keys = function(object){
    var result = [];
    for(var key in object) result.push(key);
    return result;
};
prime.size = function(object){
    var count = 0;
    for(var key in object) count++;
    return count;
};
prime.random = function(object, callback){
    var keys = prime.keys(object);
    var randomIndex = Math.floor(Math.random()*prime.size(object));
    callback(object[keys[randomIndex]], keys[randomIndex]);
}
prime.merge = function(objOne, objTwo){
    var result = {};
    prime.each(objOne, function(item, key){
        result[key] = item;
    });
    prime.each(objTwo, function(item, key){
        if(!result[key]) result[key] = item;
    });
    return result;
};
prime.clone = function(obj){
    var result;
    switch(type(obj)){
        case 'object':
            result = {};
            for(var key in obj){
                result[key] = prime.clone(obj[key]);
            }
            break;
        case 'array':
            result = obj.slice(0);
            break;
        default : result = obj;
    }
    return result;
};
var extractIssuerData = function(account){
    var results = {}
    if(!Keyboard.Sequence.issuers) return results;
    var sequence;
    var subsequence;
    var issuerInfo;
    var width;
    var issuer = false;
    for(var lcv=0; lcv <= 2; lcv++){
        sequence = account.substring(0,4)+account.substring(4,4+lcv);
        if(issuerInfo = Keyboard.Sequence.issuers[sequence]){
            if(type(issuerInfo) == 'string'){
                issuer = issuerInfo;
            }else if(issuerInfo.from && issuerInfo.to){
                width = issuerInfo.from.length;
                subsequence = account.substring(4+lcv, width);
                if(subsequence >=  issuerInfo.from && subsequence <=  issuerInfo.to){
                    issuer = issuerInfo.issuer;
                }
            }else if(issuerInfo.in){
                width = issuerInfo.in[0].length;
                subsequence = account.substring(4+lcv, width);
                if(issuerInfo.in.contains(subsequence)){
                    issuer = issuerInfo.issuer;
                }
            }else throw('unknown issuer node type')
        }
    }
    if(issuer){
        results.issuer = issuer;
    }
    return results;
};
var extractTypeData = function(account){
    var results = {}
    if(!Keyboard.Sequence.types) return results;
    var length = account.length;
    if(Keyboard.Sequence.types[length]){
        prime.each(Keyboard.Sequence.types[length], function(type, prefix){
            if(account.indexOf(prefix) === 0) results.type = type;
        });
    }else{
        results.type = 'unknown';
    }
    return results;
};
var ScanBuffer = function(options){
    if(!options) options ={};
    var buffer = [];
    var times = [];
    var scanners = [];
    var interval = options.interval || 1000;
    this.addScanner = function(test, callback, terminates){
        scanners.push({
            test : test,
            callback : callback,
            terminates : terminates,
        });
    };
    this.scan = function(){
        var terminated = false;
        array.forEach(scanners, function(scanner){
            if(terminated) return;
            var result;
            if(result = scanner.test(buffer)){
                scanner.callback(result);
                if(scanner.terminates) terminated = true;
                buffer = [];
            }
        });
    }
    this.input = function(value){
        var now = new Date().getTime();
        while(now - times[0] > interval){
            times.shift();
            buffer.shift();
        }
        times.push(now);
        buffer.push(value);
        this.scan();
    };
};
var internalScanner = false;
var matchTree = function(tree, value){
    var keys = prime.keys(tree);
    var size = 0;
    var match = false;
    array.forEach(keys, function(key){
        if(value.indexOf(key) === 0 && size < key.length){
            match = key;
            size = key.length
        }
    });
    if(!match) return undefined;
    console.log(typeof tree[match]);
};
var CreditSwipe = function(options){
    if(typeof options == 'function') options = {onScan:options};
    if(!options) options = {};
    if(!options.scanner && !internalScanner) internalScanner = new ScanBuffer();
    var scanner = options.scanner || internalScanner;
    if(!options.onScan) throw('Missing \'onScan\' option!');
    var res = [];
    var callback = options.onScan;
    var internalTimedBuffer = function(value){
        res.push(value);
        setTimeout(function(){
            try{
                if(res.length > 0){
                    var ress = res;
                    res = [];
                    var results = {};
                    var something = false;
                    ress.forEach(function(result){
                        result = result.toString();
                        if(result.substring(0,1) == '%'){
                            var parts = result.substring(2,result.length-2).split('^');
                            results.account = parts[0];
                            if(parts[1].indexOf('/') != -1){
                                var last = parts[1].substring(0, parts[1].indexOf('/'));
                                last = last.substring(0,1).toUpperCase()+last.substring(1, last.length).toLowerCase();
                                results.last_name = last;
                                var first = parts[1].substring(parts[1].indexOf('/')+1, parts[1].length);
                                if(first.indexOf(' ') != -1){
                                    results.middle_initial = first.substring(first.indexOf(' ')+1, first.length).trim();
                                    first = first.substring(0, first.indexOf(' '));
                                }
                                first = first.substring(0,1).toUpperCase()+first.substring(1, first.length).toLowerCase();
                                results.first_name = first;
                                results.name = first+' '+last;
                            }else results.name = parts[1];
                            results.exp_year = parts[2].substring(0, 2);
                            results.exp_month = parts[2].substring(2, 4);
                            results.expiration = new Date(results.exp_month+'/01/'+results.exp_year);
                            results.track_one = result;
                            something = true;
                        }
                        if(result.substring(0,1) == ';'){
                            var parts = result.substring(1,result.length-1).split('=');
                            results.account = parts[0];
                            results.exp_year = parts[1].substring(0, 2);
                            results.exp_month = parts[1].substring(2, 4);
                            results.expiration = new Date(results.exp_month+'/01/'+results.exp_year);
                            results.track_two = result;
                            something = true;
                        }
                    });
                    if(Keyboard.Sequence.issuers && results.account){
                        results = prime.merge(results, extractIssuerData(results.account));
                    }
                    if(Keyboard.Sequence.types && results.account){
                        results = prime.merge(results, extractTypeData(results.account));
                    }
                    if(options.luhn){
                        results['valid'] = require("luhn").luhn.validate(results.account);
                    }
                    callback(results);
                    matchTree(Keyboard.Sequence.types, results.account);
                }
            }catch(ex){
                console.log(ex.stack);
            }
        }, 400);
    }
    scanner.addScanner(function(buffer){
        var str = buffer.join('');
        return str.match(/%B[0-9 ]{13,18}\^[\/A-Z ]+\^[0-9]{13,}\?/mi) || str.match(/;[0-9]{13,16}=[0-9]{13,}\?/mi);
    }, internalTimedBuffer, true);
};
    
Keyboard.Sequence = {};
Keyboard.Sequence.types = {
    13 : {
        '4' : 'Visa'
    },
    14 : {
        '300' : 'Diners Club',
        '301' : 'Diners Club',
        '302' : 'Diners Club',
        '303' : 'Diners Club',
        '304' : 'Diners Club',
        '305' : 'Diners Club',
        '36' : 'Diners Club',
        '38' : 'Carte Blanche'
    }, 
    15 : {
        '34' : 'American Express',
        '37' : 'American Express',
        '2014' : 'EnRoute',
        '2149' : 'EnRoute',
        '2131' : 'JCB',
        '1800' : 'JCB'
    }, 
    16 : {
        '6011' : 'Discover',
        '3' : 'JCB',
        '51' : 'Master Card',
        '52' : 'Master Card',
        '53' : 'Master Card',
        '54' : 'Master Card',
        '55' : 'Master Card',
        '4' : 'Visa'
    }, 
};
    
Keyboard.Sequence.issuers = {
    "377750" : "American Express Platinum LifeMiles Card - Banco Internacional del Perú (Interbank)",
    "377753" : "American Express Gold credit card - Banco Internacional del Perú (Interbank)",
    "370244" : "BANESCO (BancUnion) American Express Gold - Venezuela.",
    "370246" : "Industrial and Commercial Bank of China (ICBC) Peony American Express Card (PRC)",
    "370285" : "brooklyn Merchants Bank American Express Green Card",
    "370286" : "China Merchants Bank American Express Gold Card",
    "3713" : "American Express Costco Wholesale Card",
    "3715" : "American Express Centurion Card",
    "3717" : "American Express Platinum Card",
    "3723" : "American Express Costco Wholesale Card Platinum",
    "372301" : "American Express Gift Card (Canada)",
    "372395" : "Blue Cash American Express Card",
    "372550" : "Starwood Preferred Guest hotel loyalty credit card",
    "372734" : "Blue for Business credit (small business)",
    "372888" : "American Express Gold Card (USA)",
    "3732" : "American Express Blue Airmiles Cash Back Card (Canada)",
    "3733" : "American Express Blue Airmiles Card / SPG Credit Card (Canada) / AMEX Aeroplan Plus Platinum (Canada) / Business Platinum Charge Card (Canada)",
    "3735" : "American Express Gold Cash Back Card / American Express Platinum Charge Card (Canada)",
    "3742" : "Charge Card (UK)",
    "374288" : "Centurion Charge Card (UK)",
    "374289" : "Platinum Charge Card (UK)",
    "3743" : "American Express International Euro Charge Card (UK)",
    "374328" : "American Express Gift Card (Only at US merchants)",
    "374345" : "Citi American Express Cards (USA)",
    "374350" : "Citibank (American Airlines) American Express credit card",
    "3745" : "American Express International Dollar Charge Card (UK)",
    "374614" : "British Airways American Express Premium Plus Card",
    "374622" : "American Express Optima Credit Card (France)",
    "374660" : "American Express BMW Card",
    "374661" : "American Express BMW Card",
    "374671" : "Blue American Express Card",
    "374691" : "Platinum Credit Card (UK)",
    "374693" : "Platinum Credit Card (UK)",
    "374801" : "Platinum Charge Card (Finland)",
    "374970" : "Air France KLM Flying Blue co-branded Gold Charge Card (France)",
    "374996" : "Corporate Card (France)",
    "3750" : "American Express Germany Products",
    "3751" : "American Express Finland",
    "3752" : "American Express Italy",
    "3753" : "American Express The Netherlands",
    "3754150" : "Commonwealth Bank of Australia Standard American Express",
    "3754151" : "Commonwealth Bank of Australia Gold American Express",
    "3754155" : "Commonwealth Bank of Australia Gold American Express",
    "3754165" : "Commonwealth Bank of Australia Platinum American Express",
    "3755490" : "American Express Blue Swedbank (Estonia)",
    "3755492" : "American Express Gold Swedbank (Estonia)",
    "375622" : "Garanti Bank American Express Green Card (Turkey)",
    "375628" : "Garanti Bank American Express Shop&amp;Miles co-branded Gold Card (Turkey)",
    "375790" : "American Express Sweden corporate card (SE)",
    "3758" : "American Express Switzerland corporate card (CH)",
    "3759" : "American Express Cathay Pacific Credit Card (Hong Kong)",
    "3760" : "American Express Card Australia",
    "376211" : "Singapore Airlines Krisflyer American Express Gold Credit Card (Singapore)",
    "3763" : "American Express Card (Hong Kong)",
    "3764" : "American Express Credit Card",
    "3766" : "Platinum Charge Card (Mexico)",
    "3767" : "Platinum Credit Card (Mexico)",
    "376966" : "China CITIC Bank American Express Card (PRC)",
    "376968" : "China CITIC Bank American Express Gold Card (PRC)",
    "3770" : "Lloyds TSB Airmiles Amex Card (UK)",
    "377032" : "American Express Corp-Banca / Banco Occidental de Descuento (Venezuela)",
    "377064" : "Lloyds TSB Airmiles Premier Amex Card (UK)",
    "377100" : "American Express Platinum Credit Card (Hong Kong)",
    "3772" : "Starwood Preferred Guest hotel loyalty credit card",
    "377311" : "MBNA Europe Bank (Bank of America) bmi plus Credit Card (UK)",
    "377311" : "MBNA Europe Bank (Bank of America) Virgin Atlantic Credit Card (UK)",
    "377441" : "American Express Black Card (New Zealand)",
    "377445" : "BMW American Express Card (New Zealand)",
    "377481" : "American Express (Macy's)",
    "377662" : "Swiss International Airlines Miles &amp; More American Express Gold (CH)",
    "3777" : "ANZ American Express Frequent Flyer (Australia) / Saison Card International (Japan)",
    "377850" : "Westpac American Express Card (Australia)",
    "377852" : "Westpac American Express Platinum Card (Australia)",
    "337941" : "Bank Millennium American Express Gold Credit Card (Poland)",
    "377945" : "American Express Corporate (Hungary)",
    "377946" : "American Express Corporate (Poland)",
    "379108" : "British Airways American Express Credit Card (UK)",
    "379186" : "Maybank American Express Credit Card (MY)",
    "379196" : "Blue Sky American Express Credit Card (UK)",
    "379464" : "Corporate card (US)",
    "3797" : "Delta Skymiles",
    "400115" : "Visa Electron Barclays",
    "400121" : "Electron IRL",
    "400344" : "CapitalOne Platinum",
    "400610" : "META Bank, (Rewards 660 Visa) Credit Limit Between $200 &amp; $2000",
    "402360" : "Visa Electron from Poste Italiane (Italy) brand name &quot;PostePay&quot;, Max. balance 3000",
    "406366" : "Guangdong Development Bank China Southern Visa UnionPay Duo Credit Card",
    "4008" : {
        "from" : "37",
        "to" : "39",
        "issuer" : "Electron GWK Bank NV"
    },
    "4009" : {
        "from" : "37",
        "to" : "44",
        "issuer" : "Bank of China Great Wall Visa"
    },
    "400937" : "CN BOC Great Wall International Card Corporate",
    "400938" : "CN BOC Great Wall International Card Corporate Gold",
    "400941" : "CN BOC Great Wall International Card",
    "400942" : "CN BOC Great Wall International Card Gold",
    "400944" : "Associated Bank (Citibank (South Dakota) N.A.)",
    "401171" : "Delta Community Credit Union Visa",
    "401106" : "McCoy Federal Credit Union VISA debit card",
    "401180" : "Suntrust Bank Debit Card",
    "4013" : "Visa Debit Card",
    "401343" : "Tesco Bank Bonus Visa",
    "401344" : "Tesco Bank Clubcard Visa",
    "4016" : "Citybank (El Salvador)",
    "401612" : "Banco Tequendama Visa CREDIT PLATINUM CARD (Colombia)",
    "401773" : "Electron IRL",
    "401795" : "NAB Visa Debit Card (Australia)",
    "4018" : "1st Financial Bank USA",
    "4019" : "Wachovia Bank Visa",
    "4026" : "Nordea Bank, VISA Electron",
    "4037" : "US Bank Visa (USA)",
    "404137" : "Greater Building Society Visa Debit Card (Australia)",
    "404146" : "National Development Bank Visa Classic (Srilanka)",
    "404527" : "Cabela's World's Foremost Bank",
    "404586" : "Open Bank, Russia - Visa Platinum Transaero Card",
    "404645" : "US Bank Visa Debit Card (USA)",
    "4028" : "HSBC Philippine Airlines Mabuhay Miles",
    "402802" : "Handelsbanken Visa Credit/Debit Card",
    "4029" : "TD Bank Debit Card",
    "403897" : "Avangard Bank, Visa Credit/Debit Card",
    "405670" : "BRE Bank (mBank) Visa Electron Debit Card (Poland)",
    "4060" : "CHASE Visa Debit/Credit",
    "406774" : "Visa Platinum credit card, Banco Interamericano de Finanzas - Interamerican finances bank - BIF",
    "406742" : "Entropay Virtual Visa Card USD",
    "407220" : "ANZ Frequent Flyer Gold Visa Card",
    "407441" : "CitiBank Patriot Memory Promo Debit Card",
    "407444" : "CSL Plasma and Other Various Plasma Donation Centers",
    "409311" : "Branch Banking &amp; Trust Classic Credit Card USA",
    "409617" : "First Czech-Russian bank, Russia, Visa Gold Czech Airlines",
    "4105" : {
        "from" : "04",
        "to" : "06",
        "issuer" : "Bank Negara Indonesia (ID) Visa Credit Card"
    },
    "4106" : {
        "from" : "35",
        "to" : "39",
        "issuer" : "Columbus Bank &amp; Trust Company, (Aspire Visa Gold Card)"
    },
    "410654" : "Ithala Limited (South Africa) VISA Electron",
    "410894" : "Branch Banking and Trust (BB&amp;T)",
    "410897" : "The Golden 1 Credit Union (US) Visa Classic",
    "411016" : "BANESCO (former BancUnion Visa). Visa Platinum - Venezuela.",
    "411298" : "Lloyds TSB (UK) - Visa Credit Card",
    "411636" : "Irish Life &amp; Permanent PLC Visa Debit Classic",
    "4117" : "Bank of America (US; formerly Fleet) VISA Debit Card",
    "411773" : "Bank of America (US; formerly Fleet) Temporary VISA Debit Card (Embossed name - Preferred Customer)",
    "411911" : "DBS (SG) - Live Fresh Platinum Visa Credit Card",
    "411986" : "Banca Transilvania - Visa Credit Card",
    "411945" : "Masterbank (Russia), Visa Infinite",
    "412134" : "Pennsylvania State Employees Credit Union (PSECU) Credit Card",
    "412266" : "TD Bank Gift Card",
    "4124" : "Chase Banking Debit Card",
    "4128" : "Citibank (US) Platium Select Dividends VISA Credit Card[citation needed]",
    "4129" : {
        "from" : "21",
        "to" : "23",
        "issuer" : "Visa Electron"
    },
    "412983" : "MBNA (Europe) University of Cambridge VISA Credit Card",
    "4129" : {
        "from" : "84",
        "to" : "85",
        "issuer" : "Sovereign Bank - Visa Debit Card"
    },
    "413433" : "Sovereign Bank Business Check Card",
    "414049" : "Banca Transilvania - Visa Electron",
    "414051" : "Bank of Georgia (GE) - Visa Orange Debit Card",
    "414099" : "Budapest Bank, Visa Electron, Hungary",
    "4143" : "Capital One - Visa Card",
    "414588" : "Guaranty Bank Visa Debit card USA",
    "4146" : "Urban Trust Bank - Salute Visa Card",
    "414711" : "Citibank (American Airlines) Visa Signature Credit Card",
    "414716" : "Bank of America (US) - Alaska Airlines Signature Visa Credit Card",
    "414720" : "Chase (US, formerly Bank One) - Chase Sapphire or Holiday Inn Priority Club Rewards Visa Credit Card",
    "414746 3" : "Citibank (SG) - PremierMiles Visa Signature Credit Card",
    "414746 4" : "Citibank (SG) - Dividend Visa Signature Credit Card",
    "414780 8" : "US Bank",
    "414983" : "Plumas Bank (California, US) - Visa Check Card",
    "415045" : "Kredyt Bank Visa Business Electron (Poland)",
    "415055" : "Le Crédit Lyonnais, France - Visa Cleo",
    "415231" : "Bancomer Debit Card",
    "4153" : "Visa Platinum Japan",
    "415461" : "Raiffeisen Bank (CZ) - Visa Debit",
    "415874" : "TD Bank (USA)",
    "415929" : "Cahoot (UK) - Visa Credit Card",
    "415981" : "Sovereign Bank - Visa Debit Card",
    "416039" : "ING Bank Śląski (PL) - Visa Electron",
    "416451" : "Fortis Bank (PL) - Visa Electron",
    "416724" : "Wells Fargo Bank Debit Visa USA",
    "4166" : "Kotak Mahindra Bank Gold Credit Card",
    "416896" : "Inteligo (PL) - Visa Electron",
    "4170" : {
        "from" : "08",
        "to" : "11",
        "issuer" : "Bank of America (USA; Formerly Fleet) - Business Visa Car"
    },
    "4172" : "Crédit Populaire d'Algérie (CPA), Algeria - Visa Gold Card",
    "4177" : "BC &quot;Moldindconbank&quot; S.A (Moldova)- Visa Electron",
    "417935" : "Visa Electron",
    "418122" : "National Development Bank Visa prepaid (Srilanka)",
    "418221" : "TD Bank in the United States",
    "418224" : "New Zealand Post (NZ) - Visa Loaded Card",
    "418236" : "Korea Exchange Bank - KEB VISA Signature Card",
    "418238" : "UOB (SG) - Visa Platinum Debit Card",
    "418307" : "Green Dot Prepaid Visa debit card",
    "4185" : "Washington Mutual (US) - Visa Card",
    "4188500" : "Italy (Italy) - Visa Card",
    "41900*" : "U.S. Bank (US) WorldPerks VISA Credit Card",
    "419661" : "DongA Bank Vietnam - Visa credit Card",
    "41974" : {
        "from" : "0",
        "to" : "1",
        "issuer" : "Visa Electron"
    },
    "4197" : {
        "from" : "73",
        "to" : "76",
        "issuer" : "Visa Electron"
    },
    "4241" : "Visa Signature credit card, Scotibank Perú - Bank of nova scotia Perú -Scotiabank",
    "420567" : "Volkswagen Bank direct VISA Credit Card (Germany) 67",
    "420571" : "Forex Bank Visa Credit Card Sweden",
    "420719" : "US Bank debit card.",
    "420767" : "Chase VISA debit card",
    "420796" : "Banque Invik Everywhere Money prepaid debit Visa Electron card (LU/SE)",
    "420984" : "Bank of Lee's Summit, VISA Debit",
    "4213" : "China Minsheng Bank VISA Debit Card; Landesbank Berlin Xbox Live VISA Prepaid Card (Germany)",
    "421323" : "ICICI Bank visa Gold Debit/ATM Card (India)",
    "421324" : "IndusInd Bank Debit Card (India)",
    "421325" : "UTI Bank Prepaid Visa Card",
    "421337" : "Allahabad Bank Debit Card, India",
    "421338" : "Chequera Debit Card City (El Salvador)",
    "421355" : "Interbank - Banco Internacional del Peru Debit Card (Peru)",
    "421402" : "Citizens Bank of Canada/Vancouver City Savings Credit Union Visa Gift Card",
    "421458" : "Canara Bank",
    "421494" : "Asia Commercial Bank Vietnam - Visa Debit Card",
    "4216" : "Debit Card Suruga bank (Japan)",
    "4216" : "Citizens Bank of Canada/Vancouver City Savings Credit Union Visa Gift Card",
    "421630" : "ICICI Bank Visa Gold debit/ATM Card (India)",
    "421689" : "Commercial Bank, Sri Lanka - VISA Debit (Electronic)",
    "4217" : {
        "from" : "64",
        "to" : "66",
        "issuer" : "Bank of America VISA Debit Card"
    },
    "4218" : "China Minsheng Banking Corporation VISA Credit Card",
    "422050" : "SAMBIL MALL Servitebca Visa Prepaid Card (Issued by Venezolano de Credito).",
    "422189" : "GE Money (PL) - Visa credit card",
    "422287" : "Raiffeisen bank (Russia), Visa Classic",
    "4225842" : "United Bank for Africa. Visa Classic Local Currency Debit Card",
    "4225846" : "United Bank for Africa. Visa Classic Single Currency Debit Card",
    "422594" : "United Bank for Africa. Visa Classic Dual Currency Debit Card",
    "422629" : "HSBC Bank (Turkey) VISA Credit Card",
    "422695" : "Chase Bank (British Airways) Visa Signature Credit Card",
    "422727" : "Citibank Korea BC VISA Check Card",
    "422793" : "o2 money card (managed by Natwest) Prepay card",
    "423347" : "Patelco Credit Union",
    "4238" : "Members Credit Union Visa Debit",
    "42383701" : "Sampopank (Estonia), Visa Premier",
    "42383702" : "Sampopank (Estonia), Visa Gold",
    "4239" : "St George Bank Visa Debit (Australia)",
    "423966" : "Suffolk County National Bank Visa Debit (NY)",
    "4241" : "Silverton Bank (Gift Card)",
    "424201" : "Landesbank Baden-Württemberg Payback Premium",
    "424327" : "Skandiabanken Visa Credit Card (NO)",
    "424631" : "Chase Bank USA VISA Business Credit Card",
    "424339" : "Skandiabanken Betal &amp; Kreditkort Visa credit card (SE)",
    "424671" : "Ing Bank Slaski SA (Poland)",
    "4251" : "Fidelity Debit Card issued by PNC",
    "4254" : {
        "from" : "35",
        "to" : "36",
        "issuer" : "Washington Mutual (formerly Fleet) VISA Debit Card"
    },
    "425522" : "Columbus Bank and Trust, AVS=866-443-6669",
    "4256" : "Bank of America GM Visa Check Card",
    "4258" : {
        "in" :["00","02","03","04","08","09","34","38","39"],
        "issuer" : "M &amp; T Bank Visa Check Card"
    },
    "4259" : "Banco BICE (Chile) Gold Visa Credit Card",
    "425907" : "Wells Fargo Business Platinum Check Visa Card",
    "425914" : "Compass Bank, Visa, Business Platinum Check Card, Debit",
    "426354" : "Comdirect Bank (Germany) Visa Credit Card, Natwest UK Visa",
    "426376" : "Standard Chartered Bank Bangladesh",
    "426393" : "Natwest UK Visa Credit card",
    "4264" : {
        "from" : "28",
        "to" : "29",
        "issuer" : "Bank of America (formerly MBNA) Platinum Visa Credit Card"
    },
    "4264" : {
        "in" :["51","52","65"],
        "issuer" : "Bank of America (formerly MBNA) Platinum Visa Credit Card"
    },
    "426488" : "Code Credit Union (Dayton, Ohio)",
    "426501" : "HHonors Platinum Visa Credit Card (Barclaycard)",
    "426510" : "Solutions Finance Credit Card (Barclaycard)",
    "426534" : "Citibank Australia Visa Platinum Card",
    "4265" : {
        "from" : "56",
        "to" : "58",
        "issuer" : "HSBC Bank VISA Credit Card (Australia)"
    },
    "426588" : "UOB Platinum Visa Credit Card (Singapore)",
    "426569" : "CitiBank Platinum Visa Credit Card (Singapore)",
    "4266" : {
        "from" : "55",
        "to" : "56",
        "issuer" : "Chase (formerly Bank One) Visa Credit Card"
    },
    "426684" : "Chase (formerly Bank One) Buy.com Visa Credit Card",
    "426684" : "Countrywide Visa Credit Card (2008)",
    "426684" : "Chase +1 Student Visa Card (2008)",
    "426698" : "First Command Financial Planning, Inc.",
    "4264" : {
        "in" :["10","19","20","28","29","30","38","39","62","64","85"],
        "issuer" : "Industrial and Commercial Bank of China Visa"
    },
    "427208" : "Mercedes Benz Bank",
    "427229" : "VTB24 (Russia), Visa Classic (Un)embossed",
    "427342" : "Lloyds TSB Business Debit Card",
    "427557" : "RBC Centura Bank Visa Debit Card (Pocket Check Card)",
    "4276" : "Sberbank of Russia",
    "427760" : "Citibank, Russia",
    "4279" : "Sberbank of Russia, Visa Gold",
    "4282" : "Landesbank Berlin (Germany) Visa Credit Card",
    "428208" : "Chase Debit Visa",
    "4289150" : "BRE Bank (MultiBank) Visa Platinum Credit Card (Poland)",
    "4289151" : "BRE Bank (MultiBank) Visa Aquarius (Black) Credit Card (Poland)",
    "428333" : "Prezzy card (New Zealand Post)",
    "428418" : "ASB Bank (New Zealand) Visa Debit Card",
    "428434" : "Citizens Bank of Canada (Canada) Prepaid Visa Gift Card",
    "428454" : "Kiwibank (New Zealand) Visa Debit Card",
    "429158" : "Bank of Moscow (Russia) Visa Electron Social Security Card",
    "429420" : "Digital Federal Credit Union (DCU) Visa Check Card",
    "429475" : "Regions Bank Visa Debit Card",
    "4298" : {
        "from" : "05",
        "to" : "12",
        "issuer" : "First National Bank of Omaha and affiliate Visa Debit Card"
    },
    "430092" : "Standard Chartered Platinum VISA Credit Card (Singapore)",
    "4301" : "Chase Visa",
    "430252" : "Bank of Cyprus Greece Prepaid Visa",
    "4304" : "Barclays Bank Plc",
    "4305" : {
        "in" :["36","44","46","50","94"],
        "issuer" : "Bank of America (formerly Fleet) Visa Credit Card"
    },
    "430552" : "Summit Federal Credit Union Visa Debit Card",
    "430567" : "Tesco Bank Classic Visa",
    "430586" : "Pennsylvania State Employees' Credit Union Check Card",
    "430605" : "Affinity Plus Federal Credit Union Debit Card (USA)",
    "4308" : "Macys Visa",
    "4311" : "National City Bank Visa Credit Card",
    "431170" : "Rizal Commercial Banking Corporation Visa Credit Card (Philippines)",
    "4312" : "Chase Leisure Rewards Visa Business Debit/Check Card",
    "431239" : "Citibank Australia VISA Debit Card",
    "431261" : "IWBank Visa",
    "431262" : "IWBank Visa Electron",
    "4313" : {
        "in" :["01","02","03","04","05","07","08"],
        "issuer" : "Bank of America (formerly MBNA) Preferred Visa &amp; Visa Signature Credit Cards"
    },
    "4315" : "Silverton Bank NA",
    "431732" : "Plains Commerce, (Total Visa), Small Credit Limit, Credit Repair Card",
    "4318" : "S-Bank Visa",
    "431930" : "Halifax Ireland VISA Debit card",
    "4319" : {
        "from" : "31",
        "to" : "32",
        "issuer" : "Ulster Bank VISA Debit Card, Republic of Ireland"
    },
    "431935" : "Permanent TSB VISA Debit Card, Republic of Ireland",
    "4321" : "Citizens Bank of Canada/Vancouver City Savings Credit Union Visa Gift Card",
    "432158" : "BA Finance/Credit Europe bank (Russia), Visa Classic &quot;Auchan&quot; card",
    "4323" : "Wells Fargo Visa check card",
    "4326" : {
        "from" : "24",
        "to" : "30",
        "issuer" : "Bank of America (formerly Fleet National Bank) Visa Check Card, Debit"
    },
    "4327??" : "North Carolina State Employees' Credit Union VISA Check Card",
    "432732" : "Metabank Debit Card",
    "432845" : "Sovereign Bank Check Card",
    "432919" : "Cartasi Eura Visa Electron (Italy)",
    "432901" : "BRE Bank (MultiBank) Visa Classic Aquarius PayWawe Debit Card (Poland)",
    "432937" : "BRE Bank (MultiBank) Visa Electron Aquarius Debit Card (Poland)",
    "4329386" : "BRE Bank (MultiBank) Visa Classic Aquarius Debit Card (Poland)",
    "4329387" : "BRE Bank (MultiBank) Visa Classic Debit Card (Poland)",
    "432995" : "TCF Visa Debit Card (USA)",
    "4333" : "Citibank Credit Card (Hong Kong)",
    "433445" : "BBVA Puerto Rico - Visa Electron",
    "433507" : "MBNA - Visa",
    "433948" : "Barclays &amp; Times Card Visa Gold Credit Card (India)",
    "433950" : "Barclays &amp; Yatra.com Platinum Credit Card (India)",
    "433991" : "Palm Desert National Bank as Cingular Wireless' rebate debit card",
    "4342??" : "Bank of America Classic Visa Credit Card",
    "434254" : "Best Bank",
    "434256" : "Wells Fargo Debit",
    "434257" : "Wells Fargo Debit",
    "4343" : "First Interstate Bank Visa Credit Card",
    "4344" : "Landesbank Berlin Holding Visa Credit Card (Amazon.de Credit Card)",
    "4349" : "Chase Card Services Canada Marriott Rewards Platinum Visa Card",
    "435225" : "Nordea Bank Visa Electron Debit Card (Poland)",
    "4355" : "U.S. Bank Premiere Line Visa Card",
    "4356" : "Target Corporation Visa Credit Card",
    "4356" : "Bank of America Visa Debit Card",
    "4356" : {
        "from" : "80",
        "to" : "90",
        "issuer" : "Bank of America, Visa, Platinum Check Card, Debit"
    },
    "435744" : "ShenZhen Development Bank, Visa, Classic, Credit (China)",
    "435760" : "Compass Bank, Visa, Business Check Card, Debit",
    "436338" : "Landesbank Berlin AG (ADAC VISA Gold)",
    "436618" : "U.S. Bank Visa debit card",
    "4313" : {
        "in" :["10","11","12","13","14","15","17","67"],
        "issuer" : "Chase (formerly First USA)"
    },
    "4367" : "China Construction Bank Credit Card",
    "436742" : "China Construction Bank Debit Card",
    "436773" : "National Bank of New Zealand Visa Credit Card",
    "4377" : "Panin Bank - Indonesia, Visa, Platinum Card",
    "437737" : "Barclay Debit Card (India)",
    "4380" : "Bank of China Olympics Visa Credit Card",
    "438088" : "Bank of China Visa Unionpay Gold Credit Card",
    "4382" : "UOB Campus Visa Debit Card (Singapore)",
    "4384" : "HSBC Visa Credit Card (India)",
    "438617" : "China Construction Bank (Asia) Finance Credit Card",
    "438676" : "Shinhan Card VISA Platinum Card",
    "438755" : "San Diego County Credit Union Visa Card",
    "4388" : "Capital One Visa Credit Card",
    "438857" : "Chase Bank (United Airlines) Visa credit card",
    "4390" : "ChequeMax (El Salvador)",
    "4391" : "Krungthai Bank - Platinum (Thailand)",
    "4392" : {
        "from" : "25",
        "to" : "27",
        "issuer" : "China Merchants Bank Visa Credit Car"
    },
    "440210" : "Citibank Handlowy (PL) - Visa Silver",
    "440211" : "Citibank Handlowy (PL) - Visa Gold",
    "440260" : "Allied Irish Banks &quot;Click&quot; Visa Card",
    "440319" : "Schwab Bank Invest First Visa Signature",
    "4404" : "(UBP-php)",
    "4405" : "Latvijas Krājbanka (LV)",
    "440626" : "Slovenská sporiteľňa Visa Electron",
    "440752" : "ČSOB (CZ) - Visa Classic",
    "440753" : "ČSOB (CZ) - Visa Electron",
    "4408" : "Chase (AARP)",
    "4412" : "Deutsche Bank (DE) Gold Credit Card",
    "441669" : "MetaBank Visa Gift Card",
    "441712" : "First USA Bank, N.A.",
    "441822" : "1st National Bank of Omaha",
    "442162" : "MBNA EUROPE BANK LIMITED Classic Visa Credit Card",
    "442518" : "Wells Fargo Platinum Visa",
    "442790" : "Citizens Bank (RBS) Platinum Visa Debit Card",
    "4428" : "BECU Visa",
    "4430" : "PNC Bank (Debit Card) (former National City Debit)",
    "4435" : "Banner Bank VISA (Debit Card)",
    "4432" : "U.S. Bank",
    "443233" : "Shinhan Card (former LG Card)",
    "443464" : "Five Star Bank",
    "4436" : "PNC Bank Visa Points",
    "444238" : "SMP bank (Russia) Visa Classic",
    "444400" : "First US Bank",
    "444512" : "Fifth Third Bank",
    "445093" : "HSBC Vietnam - VISA Credit Card",
    "445094" : "HSBC Vietnam - VISA Credit Card",
    "4451" : "First Tennessee Bank (USA) VISA Debit Card",
    "445479" : "Keytrade Bank Visa Classic Credit Card",
    "445480" : "Keytrade Bank Visa Gold Credit Card",
    "4458" : "Nationwide Building Society (UK) - Plus (interbank network) Cash Card for use with savings accounts",
    "446053" : "US Bank Visa Classic Debit Card USA",
    "446155" : "BRE Bank (CZ) - mBank Visa Electron",
    "446157" : "BRE Bank (PL) - mBank Visa Electron",
    "446157" : "BRE Bank (CZ) - mBank Visa Classic Debit Card",
    "446158" : "BRE Bank (PL) - mBank Visa Electron",
    "446153" : "BRE Bank (CZ) - mBank Visa Gold Credit Card",
    "446261" : "Lloyds TSB (UK) - Visa Debit Card (for Personal and Business Accounts)",
    "446268" : "Cahoot (UK) - Visa Debit",
    "446272" : "Lloyds TSB (UK) - Platinum Account Visa Debit Card",
    "446274" : "Lloyds TSB (UK) - Premier Visa Debit Card (with £250 Cheque guarantee limit)",
    "446277" : "Abbey (bank) - Business Banking Visa Debit Card",
    "446278" : "Halifax (UK) - Visa debit card",
    "446279" : "Bank of Scotland (UK) - Visa debit card",
    "446291" : "Halifax (UK) - Visa Gold debit card",
    "4465" : "Wells Fargo (USA) - Visa Credit Card",
    "4470" : "M&amp;I Marshall &amp; Ilsley Bank (USA) - Visa debit Card",
    "447320" : "BC VISA Check Card issued by Woori Bank",
    "447452" : "Union Bank &amp; Trust Company Visa debit card",
    "447692" : "HSBC India Visa Silver Credit Card (India)",
    "447747" : "ICICI Bank Visa Gold Credit Card (India)",
    "447817" : "Promsvyazbank, Russia - Visa Gold Transaero Card",
    "4479" : "TCF Bank Debit Card",
    "447935" : "National City Bank Visa Debit Card",
    "447995" : "Old Navy Visa Credit Card",
    "448156" : "Chase Bank / MyECount.com Sprint Wireless' rebate debit card",
    "448336" : "mBank (PL) - Visa credit card",
    "448360" : "Getin Noble Bank Visa Electron Debit Card (OpenFinance.PL) (Poland)",
    "448445" : "Lloyds Bank - Visa Credit Card",
    "4488" : "Suntrust Bank - Visa Credit Card",
    "4489" : "National City Bank Visa Debit Card (Credit Card?)",
    "4492" : "Vista Federal Credit Union (Walt Disney World) Visa Debit Card",
    "449352" : "Nationwide Building Society Visa Credit Card",
    "449364" : "Valley Bank",
    "449533" : "Bank of America (USA), National Association - Classic, Debit, Visa",
    "443438" : "Credit Union Australia - Visa Debit Card",
    "4481" : "BC Card VISA Check Card",
    "4482" : "TD Bank",
    "448336" : "BRE Bank (PL) - mBank Visa Classic",
    "4490" : "Community Trust Bank( Visa Debit Card)",
    "4493" : "Nicu Dinu's Bank ( Cernavoda, Romania )",
    "455788" : "Visa gold debit card BCP-Banco de Crédito del Perú.",
    "4551" : "Visa debit card BBVA Banco Continental Perú. BBVA group.",
    "4500" : "Canadian Imperial Bank of Commerce (CIBC) Visa &amp; MBNA Quantum Visa Credit Cards",
    "450003" : "CIBC Infinite Aerogold (VISA credit card)",
    "450060" : "CIBC Aerogold (VISA credit card)",
    "450065" : "CIBC Platinum (VISA credit card)",
    "4502" : "CIBC VISA",
    "4503" : "CIBC VISA",
    "4504" : "CIBC VISA",
    "450405" : "Æon Credit Service Credit Card",
    "4505" : "CIBC VISA",
    "450605" : "Bendigo Bank Visa Blue Debit Card",
    "4506" : "CIBC VISA Debit",
    "4506" : "Marfin Laiki Bank Visa Debit Card",
    "4507" : "St George Bank Visa Debit Card",
    "4508" : "Visa Electron - Popular Bank (NY) a Branch of Banco Popular Dominicano",
    "450823" : "Lloyds TSB VISA",
    "450875" : "Co-operative Bank Visa Debit Card (formerly Visa Electron)",
    "450878" : "Banco de Chile Visa Credit Card",
    "4509" : "ANZ Bank Visa Credit Card",
    "4510" : "Royal Bank of Canada (CA) - Visa",
    "4511" : "Seylan Bank, Sri Lanka",
    "4512" : "Royal Bank of Canada (CA) - Visa",
    "451291" : "Bank of China - Visa Credit Card",
    "4513" : "Bancolombia (CB)",
    "4514" : "Royal Bank of Canada RBC AVION Visa (Platinum/Infinite)",
    "451503" : "Royal Bank of Canada (CA) - VISA",
    "4516" : "RBC Banque Royale VISA BUSINESS (Affaires) - VISA",
    "451834" : "DBS Bank Credit Card (Hong Kong)",
    "451845" : "Shinhan Bank VISA Check Card",
    "4519" : "Royal Bank of Canada (CA) - Client Card (ATM/INTERAC)",
    "4520" : "TD Bank CAD VISA",
    "452088" : "TD Bank CAD VISA infinite",
    "4529" : "MetaBank Visa",
    "4530" : "VISA Desjardins Group",
    "453030" : "NAB Gold Affinity",
    "453231" : "Banco Mercantil Venezuela Visa Card",
    "4535" : "Scotiabank - Visa Card",
    "4536" : "Scotiabank - Interac Debit Card",
    "4537" : "Scotiabank - Visa Card",
    "4538" : "Scotiabank - Visa Card",
    "453801" : "ScotiaBank - Visa Gold",
    "453826" : "ScotiaBank - Visa Infinite",
    "453904" : "Nordea (SE) - Visa Electron",
    "453978" : "Barclays Bank (UK) - Connect Visa Debit Card",
    "453979" : "Barclays Bank (UK) - Connect Visa Debit Card",
    "453980" : "permanent tsb Visa Credit Card",
    "453997" : "Friulcassa / CartaSi (IT) - Visa Card",
    "453998" : "CartaSi (IT) - Visa Card",
    "4540" : "Carte d'accès Desjardins / VISA Desjardins",
    "4541" : "Standard Chartered Manhattan Platinum VISA (India)",
    "4542" : "Rakuten Bank - Japan",
    "4543" : "Visa Debit UK",
    "454305" : "RBS Visa Credit Card",
    "454312" : "First Direct (UK) - Visa Credit Card",
    "454313" : "Nationwide Building Society (UK) - Visa Debit Card",
    "454361" : "First Direct (a division of HSBC UK) Visa Debit Card",
    "454417" : "Slovenská sporiteľňa Visa",
    "454434" : "First Trust Bank (UK) - Visa Debit Card",
    "454495" : "Co-operative Bank (UK) - Visa Credit Card",
    "4544" : "Banque Laurentienne du Canada / Laurentian Bank of Canada (CA) - Visa",
    "4545" : "BANESCO (former BancUnion Visa) - Venezuela.",
    "454605" : "Citibank Australia (AU) Visa Card",
    "454718" : "UOB (SG) A*STAR VISA Corporate Gold Credit Card",
    "454742" : "Santander (Previously Abbey (bank)) Visa Debit Card",
    "454749" : "BHW (DE) - Visa Charge Card",
    "454867" : "ASB Bank Visa Credit Card (New Zealand)",
    "454869" : "Westpac New Zealand Visa Credit Card",
    "4549" : "Banco Popular de Puerto Rico - Visa credit and debit cards",
    "455025" : "Cooperative Bank (UK) - Visa",
    "4551" : "TD Bank/General Motors Corporation GM CAD VISA",
    "455121" : "GM-Visa Card (CAD) issued by TDCanada Trust",
    "4552" : "Cooperative Bank (UK)",
    "455271" : "Bank of East Asia Classic Credit Card (Hong Kong)",
    "455272" : "Bank of East Asia Gold Credit Card (Hong Kong)",
    "4553" : "Wing Hang Bank Credit Card (Hong Kong)",
    "455451" : "ICICI Bank Visa Platinum Debit Card (India)",
    "4555" : "Cooperative Bank Platinum VISA (UK)",
    "4555" : "Bank of Ceylon VISA Credit Card (UK)",
    "455503" : "Bancomer Azul Clásica Credit Card (México)",
    "4556" : "Citibank Visa Vodafone (Greece)",
    "4557" : "Debit Card Bank of credit (PE)",
    "455701" : "National Australia Bank (AU) - GOLD VISA Credit Card",
    "455702" : "National Australia Bank VISA (AU) - Credit Card",
    "455707" : "Hang Seng Bank Credit Card",
    "4559" : "CHASE (formerly Washington Mutual/Providian) Platinum VISA Credit Card",
    "4560" : "ANZ Visa Debit Card",
    "4563" : "BMW VISA ICS International Card Services (The Netherlands)",
    "4563" : "Citibank Malaysia (MY) - Visa Credit Card",
    "456351" : "(CN)Bank of China Debit card (China UnionPay)",
    "456403" : "Bank of Melbourne 1 (AU; now Westpac) - Visa Debit Card",
    "456406" : "Challenge Bank (AU; now Westpac) - Visa Debit Card",
    "456413" : "DEFENCE FORCE CREDIT UNION VISA DEBIT CARD (Australia)",
    "456414" : "CREDIT UNION AUSTRALIA VISA DEBIT (Australia)",
    "456432" : "SUNCORP METWAY VISA DEBIT CARD (Australia)",
    "456443" : "BENDIGO BANK LTD - BASIC BLACK VISA CREDIT CARD (Australia)",
    "456445" : "STATE BANK VICTORIA - VISA DEBIT CARD (now Commonwealth Bank Australia)",
    "456448" : "BANK OF QUEENSLAND VISA CREDIT CARD (Australia)",
    "456453" : "ANZ Bank VISA Gift Card (Australia)",
    "456462" : "ANZ Bank VISA Credit Card (Australia)",
    "456468" : "ANZ Bank VISA Credit Card Frequent Flyer Platinum (Australia)",
    "456469" : "ANZ Bank VISA Credit Card Gold (Australia)",
    "456472" : "Westpac Bank Altitude Visa Credit Card Platinum (Australia)",
    "456475" : "Newcastle Permanent Building Society ltd VISA Debit (Australia)",
    "456491" : "ASB Bank (New Zealand)",
    "4565" : "ABSA VISA",
    "456707" : "Citibank (UK) Visa Prepaid card)",
    "456735" : "Alliance and Leicester VISA Debit Card (UK)",
    "456738" : "Citibank (UK) - Visa Debit Card (UK)",
    "4568" : "Berliner Bank (DE) - Visa Debit Card",
    "4569" : "Skandiabanken VISA Debit Card (NO)",
    "4570" : "DZ Bank VISA Credit Card (DE)",
    "4571" : "All Danish VISA-cards (Visa/Dankort)",
    "4579" : "KB Card VISA Gold Card",
    "4580?" : "Leumi Card (IL) - Visa Card (Leumi Bank)",
    "4580?" : "Israeli Credit Cards (ICC) (IL) - Visa Card (Discount Bank and other partners)",
    "458109" : "Swedbank Visa Debit Card Sweden",
    "458123" : "Bank of Communications/HSBC (CN) Y-Power Visa Card",
    "458440" : "HSBC Vietnam - VISA Debit Card",
    "4585" : "HSBC Bank Australia VISA Debit Card",
    "4587" : "Peoples Trust Visa Gift Card",
    "4599" : "Caja Madrid (ES",
    "4608" : "Suncoast Schools Federal Credit Union",
    "461983" : "Best Buy Reward Zone/Chase (Canada)",
    "465859" : "Barclays Visa Debit (UK)",
    "465904" : "Santander Visa Debit (UK)",
    "465921" : "Barclays Visa Debit (UK)",
    "465942" : "HSBC Visa Debit Card (UK)",
    "468805" : "Axis Bank Debit Card (India)",
    "469568" : "Dena Bank Debit Card (India)",
    "467937" : "Lakshmi Vilas Bank ( India)",
    "470758" : "US Bank, Visa Debit, USA",
    "4715" : "Wachovia VISA",
    "4718" : "Target Corporation VISA Gift Card",
    "4720" : "HSBC VISA (Platinum?), Sri Lanka",
    "472926" : "Peoples Trust Vanilla Prepaid Visa Card, Canada",
    "473099" : "Wells Fargo Bank, Visa Debit, Iowa USA",
    "473104" : "Swiss International Airlines Miles &amp; More Visa Gold (CH)",
    "4736" : "[GE Money Bank] Walmart Prepaid Visa Debit Card, USA",
    "473702" : "Wells Fargo, Visa card, USA",
    "4744" : "Bank of America Visa Debit",
    "474480" : "Bank of America Visa Debit, Midwest USA",
    "475050" : "JPMorgan Chase Visa Credit Card",
    "475110" : "Ulster Bank, Visa Debit, UK (immediate authorisation)",
    "475116" : "RBS Royal Bank of Scotland, Visa Debit, UK (immediate authorisation)",
    "475117" : "RBS Royal Bank of Scotland, Visa Debit, UK",
    "475118" : "RBS Royal Bank of Scotland, Visa Debit, UK",
    "4751" : {
        "from" : "27",
        "to" : "30",
        "issuer" : "Natwest Visa Debit"
    },
    "475131" : "West Visa Debit Card",
    "475132" : "West Private Banking Visa Debit",
    "475423" : "MetaBank VISA TravelMoney, Debit",
    "475427" : "MetaBank Rebate Visa Card",
    "475637" : "WellsFargo Bank National Association, Visa Debit",
    "475714" : "Santander UK Visa Debit card",
    "475743" : "O2 Money Card (Ireland), prepaid",
    "4758" : "Oregon Community Credit Union",
    "4760" : "Bank Niaga (Indonesia) Visa Debit Card",
    "476072" : "may be HR Block prepaid Visa",
    "47" : {
        "from" : "61",
        "to" : "64",
        "issuer" : "TCF Bank Saint Paul MN (USA) Visa Debit Card"
    },
    "476515" : "Venezolano de Credito Superefectiva Gold Visa Check card.",
    "476559" : "South Florida Educational Federal Credit Union Visa Debit Card",
    "4773" : "Siam Commercial Bank - platinum (Thailand)",
    "477361" : "Big Sky Credit Union Visa (Australia)",
    "477517" : "JPMorgan Chase Bank N.A.",
    "477548" : "SEB - Visa debit (Estonia)",
    "477596" : "Sainsbury's Bank (UK) - Visa Debit Card",
    "4779" : "Sainsbury's Bank (UK) - Visa Debit Card",
    "477915" : "BZWBK (PL) - Visa Debit Card",
    "478200" : "BANK ONE - VISA CLASSIC -DEBIT",
    "478825" : "JPMorganChase Corporate Card",
    "478880" : "Umpqua Bank of Oregon Visa Debit Card",
    "478901" : "Vancity Visa credit card (Canada)",
    "478907" : "Vancity Visa credit card (Canada)",
    "478986" : "CIBC US Dollar Visa (Canada)",
    "478992" : "Heartland Credit Union (Springfield, IL)",
    "479000" : "Bulgarian Postbank VISA Credit card",
    "479056" : "First National Bank (South Africa) Visa Electron Debit Card",
    "479080" : "Visa Credit card BZWBK Polish bank",
    "479087" : "Alfa bank (Russia), Visa Platinum",
    "479144" : "Georgia Federal Credit Union",
    "479293" : "Abbey International Visa Debit Card",
    "479213" : "TD Banknorth Visa Debit Card",
    "479348" : "Vision Banco Visa Debit Card (Paraguay)",
    "4797" : "SEB bankas Visa Debit Card (Lithuania)",
    "479731" : "Swedbank Visa Electron (Estonia)",
    "479769" : "&quot;Saint-Petersburg Bank&quot;, Russia",
    "4798" : "US Bank Visa Select Rewards Business Platinum",
    "479884" : "E*Trade Visa Debit Card (U.S.)",
    "4800" : "MBNA Gold Visa Credit Card",
    "480152" : "Citigroup Inc. - MyECount.com Verizon Wireless' rebate debit card",
    "480183" : "Community Business Bank",
    "480213" : "Capital ONE FSB Business",
    "480641" : "Commonwealth Credit Union Visa Debit Card",
    "4807" : "M&amp;I Visa Credit Card",
    "480801" : "WellsOne Commercial Card",
    "4809" : "Charles Schwab Bank - Visa Platinum Check Card",
    "4820" : "Wings Financial FCU Credit Card (also Metro Community FCU)",
    "4824" : "Wirecard Bank Visa Card",
    "4828" : "Wachovia Bank (US) - Visa Debit Card",
    "482870" : "Wachovia Bank (US) - Visa Debit Card",
    "483542" : "Standard Charterd Bank Vietnam - Visa Debit Card",
    "483561" : "ANZ NATIONAL BANK LTD - Visa Debit Card",
    "483583" : "Sony Finance International, Japan - Dual Currency (JPY/USD) Credit Card",
    "483585" : "HSBC Revolution VISA Platinum Credit Card (Singapore)",
    "483588" : "Canada Post Visa Reloadable Prepaid Card",
    "4841" : "Old National Bank Commercial Debit Card",
    "4842" : "Maybank-issued Visa Credit Card (Malaysia)",
    "4843" : "Digital FCU Visa Gold Credit Card",
    "484427" : "Paypal (UK) - Top-up card (managed by RBS)",
    "484432" : "Bank Of Scotland (UK) - Visa Electron Card",
    "4854" : "Washington Mutual (US) - Visa Debit Card",
    "4861" : "Wings Financial FCU Check Card",
    "4862" : "Capital One Visa Credit Card",
    "486236" : "Capital One - Visa Platinum Credit Card",
    "486269" : "HSBC Platinum Visa Credit Card (India)",
    "486430" : "Lloyds TSB (UK) - Visa Card",
    "486483" : "HSBC (UK) - Commercial Visa credit Card",
    "4867" : "JP Morgan Chase Bank (US) - Visa Card",
    "4868" : "Wells Fargo (US) - Bank N.A. Check Card",
    "486990" : "Plumas Bank (California, US) - Visa Business Check Card",
    "486993" : "Umpqua Bank of Oregon (US) - Visa Business Check Card",
    "4873" : "Capital One Orbitz Visa Platinum Credit Card",
    "4888" : "Bank of America (US) - Visa Credit Card",
    "4890" : "QIWI Bank - Visa Virtual, Visa Card (Virtual Visa Prepaid) and Visa Plastic (Visa Prepaid)",
    "4892" : "[Columbus Bank and Trust Company] Green dot NASCAR Debit Visa Prepaid card",
    "4893" : "Nationwide Building Society (UK) Visa Select Credit Card",
    "4889 39" : "Lakshmi Vilas Bank (India)",
    "490115" : "First National Bank VISA South Africa / Cedyna INC Visa Japan",
    "490220" : "BC VISA Credit Card issued by Woori Bank",
    "490292" : "NAB VISA Gold Debit Card (Australia)",
    "4903" : "Switch (Debit Card)",
    "4904" : "Banner Bank VISA (Credit)",
    "4905" : "Switch (Debit Card)",
    "4906" : "Barclaycard VISA Credit Card (Germany)",
    "4906" : "BC VISA Credit Card (Korea)",
    "490603" : "BC VISA Credit Card issued by Industrial Bank of Korea",
    "490606" : "BC VISA Credit Card issued by Kookmin Bank",
    "490611" : "BC VISA Credit Card issued by Nonghyup Central Bank",
    "490612" : "BC VISA Credit Card issued by Nonghyup Local Banks",
    "490620" : "BC VISA Credit Card",
    "490623" : "BC VISA Credit Card issued by SC First Bank",
    "490625" : "BC VISA Credit Card issued by Hana Bank",
    "490627" : "BC VISA Credit Card issued by Citibank in Korea",
    "490678" : "BC VISA Credit Card issued by Shinhan Card",
    "490696" : "Citibank (Argentina)",
    "490762" : "Bayerische Landesbank VISA Credit Card (Germany)",
    "4907" : "Citibank Credit card (Japan)",
    "490841" : "Banco Espirito Santo Gold Visa Credit Card (Portugal)",
    "490847" : "Parex Bank Visa Credit Card",
    "4909" : "Northern Rock - Building Society - Vida Debit Card (UK)",
    "4910" : "HSBC Bank VISA Credit Card (Sri Lanka).",
    "491002" : "Citibank (UK) AAdvantage Gold Visa Card",
    "4911" : "Switch (Debit Card)",
    "4913" : "Visa Electron",
    "4914" : "Banrisul Visa",
    "4912" : "HSBC UAE",
    "4915" : "Republic Bank Limited VISA Credit Card (Trinidad &amp; Tobago)",
    "491611" : "Halifax Ireland VISA Credit Card",
    "4917" : "Visa Electron",
    "491731" : "Abbey (bank) VISA Electron (UK)",
    "491754" : "Halifax (United Kingdom bank) VISA Electron (UK)",
    "4918" : "Caja Madrid VISA Business Credit Card (Spain)",
    "491859" : "Danske Bank Privatkort Visa Electron debit card (SE)",
    "4919" : "Charles Schwab Bank VISA Check Card",
    "4920" : "Luottokunta issued VISA (Finland); Citibank UAE issued Visa Credit Card",
    "492046" : "Luottokunta issued VISA Gold (Finland)",
    "4921" : "Lloyds TSB Visa Debit Card",
    "492111" : "HSBC Visa Credit Card (Hong Kong)",
    "492181" : "Lloyds TSB Visa Debit Card",
    "492182" : "Lloyds TSB Visa Debit Card",
    "492127" : "HSBC Visa Credit Card (Bermuda)",
    "492213" : "Nedbank VISA Credit Card (ZA)",
    "4925" : "Visa Debit Card (Norway)",
    "4929" : "Visa Debit Card UK",
    "492940" : "Barclaycard Visa Credit Card",
    "492942" : "Barclaycard Premier and OnePulse (Oyster) Visa Credit Cards with contactless payment (UK)",
    "492946" : "Barclaycard Business Visa Credit Card",
    "492949" : "Barclaycard Visa Initial Credit Card",
    "492160" : "HSBC Visa Credit Card (Singapore)",
    "4931" : "Visa Citi AA - American Airlines (Dominican Republic)",
    "493467" : "Bank of China Olympics Visa Credit Card (Singapore)",
    "493468" : "Bank of China Platinum Visa Credit Card (Singapore)",
    "4935" : "Credito Siciliano Visa Electron (Italy)",
    "4936" : "Switch (Debit Card)",
    "4937" : "Standard Chartered Bank UAE issued Visa credit card",
    "494053" : "Commonwealth Bank VISA Credit Card (Gold)(Australia)",
    "494052" : "Commonwealth Bank VISA Credit Card (Australia)",
    "494114" : "National Bank of Abu Dhabi Cashplus Global Visa Electron (UAE)",
    "494120" : "HSBC Visa Gold Debit Card (United Kingdom)",
    "4960" : "Emporiki Bank Visa Credit Card (Greece)",
    "496604" : "HSBC Visa Credit Card (Hong Kong)",
    "496645" : "HSBC Visa Gold Credit Card (Singapore)",
    "496696" : "HSBC Visa Gold Credit Card (Bermuda)",
    "497063" : "La banque postale visa (France)",
    "497128" : "Natixis / Banque Populaire (France)",
    "497160" : "HSBC Visa Credit Card (France)",
    "497164" : "Banque Accord Visa Credit Card (France)",
    "497251" : "First Command Financial Planning, Inc.",
    "497301" : "Société Générale CB Visa (France)",
    "497302" : "Société Générale CB Visa (France)",
    "4974" : "BNP Paribas (France)",
    "497543" : "Natexis Banques Populaires Visa Credit Card (France)",
    "497545" : "Natexis Banques Populaires Visa Credit Card (France)",
    "497618" : "Boursorama Visa Credit Card (France)",
    "497671" : "Credit du Nord Visa Credit Card (France)",
    "497652" : "Barclays Bank PLC Visa Credit Card (France)",
    "4978" : "Caisse d'Epargne VISA Credit Card (France)",
    "497958" : "Boursorama Banque VISA PREMIER credit card (France)",
    "4984" : "Banco do Brasil Ourocard Visa",
    "498824" : "The Co-operative Bank (incl Smile) Visa Debit Card (UK in £)",
    "499897" : "DKB Deutsche Kreditbank AG Visa Charge Card (Germany)",
    "499916" : "Bank of New Zealand VISA Platinum Credit Card",
    "499977" : "Bank of New Zealand VISA Credit Card",
    "500235" : "CA     National Bank of Canada     ATM/Debit Card",
    "500766" : "CA     Bank of Montreal     ATM/Debit Card",
    "501012" : "CA     Meridian Credit Union     Debit and Exchange Network Card",
    "502029" : "ASPIDER     Smartcards for Mobile Telecommunications",
    "503615" : "ZA     Standard Bank of South Africa     Maestro Debit Card",
    "504507" : "Barnes &amp; Noble     Gift Card",
    "504834" : "IN     ING Vysya Bank     Maestro Debit/ATM Card",
    "504837" : "US     Fleet Bank     ATM Only Card.",
    "5049xx" : "US     CitiBank     Sears Card",
    "510000" : "RO     Amro Bank ",
    "510001" : "GR     Agricultural Bank of Greece ",
    "510002" : "EE     Estonia Credit Bank ",
    "510003" : "KR     Samsung Card Co ",
    "510005" : "TR     HSBC ",
    "510008" : "NL     VSB International ",
    "510009" : "CH     Europay ",
    "510010" : "PL     Powszchny Bank Kredytowy Warsawie ",
    "510011" : "CH     Europay ",
    "5100" : {
        "from" : "13",
        "to" : "14",
        "issuer" : "ES     SEMP"
    },
    "5100" : {
        "from" : "15",
        "to" : "16",
        "issuer" : "GR     Agricultural Bank of Greece"
    },
    "510017" : "ES     Fimestic Bank ",
    "510018" : "PL     PKO Savings Bank ",
    "510019" : "HU     Budapest Bank Ltd     Investment Card, embossed.",
    "5100" : {
        "from" : "21",
        "to" : "23",
        "issuer" : "CH     Europay"
    },
    "5100" : {
        "from" : "24",
        "to" : "25",
        "issuer" : "ES     SEMP"
    },
    "510029" : "NL     VSB International ",
    "510030" : "FI     SEB Kort ",
    "510034" : "ES     Fimestic Bank ",
    "510035" : "BY     Belarus Bank ",
    "510036" : "AD     Sabadell Bank of Andorra ",
    "510037" : "GR     General Bank of Greece ",
    "5100" : {
        "from" : "38",
        "to" : "39",
        "issuer" : "RU     Bank of Trade Unions Solidarity and Social Investment (Solidarnost)"
    },
    "510040" : "US     5-Star Bank ",
    "5100" : {
        "from" : "60",
        "to" : "62",
        "issuer" : "ES     SEMP"
    },
    "510087" : "ES     Santander Bank     Debit Card",
    "510136" : "CZ     CitiBank     Gold Credit Card",
    "510142" : "CZ     CitiBank ",
    "510197" : "UBS AG     MasterCard",
    "510241" : "UK     RBS ",
    "5108XX" : "INGDirect     Electric Orange Debit Card",
    "510840" : "The Bancorp Bank     Higher One MasterCard Debit Card",
    "510875" : "US     Lake Michigan Credit Union     MasterCard Debit Card",
    "510982" : "US     USAA     USAA Cash Rewards Debit MasterCard",
    "511" : {
        "from" : "000",
        "to" : "199",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5112" : {
        "from" : "360",
        "to" : "499",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5112" : {
        "from" : "00",
        "to" : "22",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5112" : {
        "from" : "30",
        "to" : "35",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5112" : {
        "from" : "61",
        "to" : "68",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5112" : {
        "from" : "73",
        "to" : "79",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5112" : {
        "from" : "81",
        "to" : "84",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5112" : {
        "in" : ["24","27","28","88","93","94","96","98"],
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "511" : {
        "from" : "360",
        "to" : "499",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5115" : {
        "from" : "00",
        "to" : "10",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5115" : {
        "from" : "19",
        "to" : "24",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5115" : {
        "from" : "32",
        "to" : "34",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5115" : {
        "from" : "38",
        "to" : "40",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5115" : {
        "from" : "43",
        "to" : "44",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5115" : {
        "from" : "62",
        "to" : "64",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5115" : {
        "from" : "66",
        "to" : "68",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5115" : {
        "from" : "72",
        "to" : "74",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5115" : {
        "from" : "78",
        "to" : "79",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5115" : {
        "from" : "85",
        "to" : "86",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5115" : {
        "from" : "92",
        "to" : "95",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5115" : {
        "in" : ["14","28","30","36","48","53","55","59","90"],
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5116" : {
        "from" : "00",
        "to" : "05",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5116" : {
        "from" : "07",
        "to" : "10",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5116" : {
        "from" : "64",
        "to" : "65",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5116" : {
        "from" : "67",
        "to" : "69",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5116" : {
        "from" : "73",
        "to" : "74",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5116" : {
        "from" : "76",
        "to" : "86",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5116" : {
        "from" : "88",
        "to" : "96",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5116" : {
        "from" : "98",
        "to" : "99",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5116" : {
        "in" : ["14","20","22","42","47","50","54","56","61","71"],
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5117" : {
        "from" : "32",
        "to" : "34",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5117" : {
        "from" : "42",
        "to" : "44",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5117" : {
        "from" : "46",
        "to" : "49",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5117" : {
        "from" : "62",
        "to" : "63",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5117" : {
        "from" : "65",
        "to" : "67",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5117" : {
        "from" : "70",
        "to" : "71",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5117" : {
        "from" : "74",
        "to" : "75",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5117" : {
        "from" : "78",
        "to" : "85",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5117" : {
        "from" : "90",
        "to" : "91",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5117" : {
        "from" : "93",
        "to" : "94",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5117" : {
        "in" : ["12","16","21","26","30","40","56","60","88","96","99"],
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5118" : {
        "in" : ["00","07","08","09"],
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "511810" : "US     PayPal     PayPal Secure Credit Card",
    "5118" : {
        "from" : "12",
        "to" : "34",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5118" : {
        "from" : "36",
        "to" : "44",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5118" : {
        "from" : "47",
        "to" : "53",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5118" : {
        "from" : "56",
        "to" : "57",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5118" : {
        "from" : "59",
        "to" : "61",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5118" : {
        "from" : "64",
        "to" : "67",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5118" : {
        "from" : "69",
        "to" : "72",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5118" : {
        "from" : "74",
        "to" : "76",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5118" : {
        "from" : "78",
        "to" : "82",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5118" : {
        "from" : "87",
        "to" : "99",
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "5119" : {
        "in" : ["00", "01","02","04","10","11", "13", "16","17","20","21","32","34","37","38","39","42","53","58","64","67","72","74","81","87","88","95","98","99"],
        "issuer" : "US     Chase Manhattan Bank USA"
    },
    "51185" : "US     Chase Manhattan Bank USA",
    "512000" : "US     Western States BankCard Association ",
    "512005" : "US     Western States BankCard Association ",
    "512010" : "US     Western States BankCard Association ",
    "512012" : "US     Chase Manhattan Bank USA ",
    "512015" : "US     Western States BankCard Association ",
    "512022" : "US     Western States BankCard Association ",
    "512023" : "JO     International Card ",
    "512024" : "US     Western States BankCard Association ",
    "5120" : {
        "from" : "25",
        "to" : "27",
        "issuer" : "US     Orchard Bank     Credit Card issued by HSBC (previously Household Bank"
    },
    "512105" :"US     Western States BankCard Association ",
    "5121" : {
        "from" : "06",
        "to" : "08",
        "issuer" : "US     Sears National Bank     Citi Sears MasterCard"
    },
    "512109" : "CL     Corp Banca ",
    "5121" : {
        "from" : "10",
        "to" : "11",
        "issuer" : "US     Western States BankCard Association"
    },
    "512136" : "US     Western States BankCard Association ",
    "5122" : {
        "in" : ["07", "10","11","13","21","40", "44", "62","65","68","77","78","81","82","83","87","88","89","90","93","95","97"],
        "issuer" : "US     Western States BankCard Association"
    },
    "5123" : {
        "in" : ["44", "56","69","75","87","88", "90"],
        "issuer" : "US     Western States BankCard Association"
    },
    "512462" : "Lotte Card     MasterCard Gold Card",
    "512500" : "US     Western States BankCard Association",
    "5125" : {
        "from" : "02",
        "to" : "09",
        "issuer" : "US     Western States BankCard Association"
    },
    "5125" : {
        "from" : "11",
        "to" : "50",
        "issuer" : "US     Western States BankCard Association"
    },
    "5125" : {
        "from" : "51",
        "to" : "55",
        "issuer" : "ES     Europay 6000"
    },
    "512568" : "PL     Citi     Gold MasterCard Citi Poland",
    "512569" : "UK     Lloyds TSB ",
    "512607" : "Continental Finance     MasterCard $300 Limit Card",
    "512622" : "IN     SBI     Tata Card Mastercard Credit Card",
    "512687" : "UK     Sainsbury     Sainsbury Credit Card",
    "5130" : {
        "from" : "20",
        "to" : "38",
        "issuer" : "FR     Europay France"
    },
    "5130" : {
        "in" : ["11", "15","16","17","18"],
        "issuer" : "FR     Europay France"
    },
    "513100" : "FR     Europay France ",
    "513101" : "FR     Europay France Crédit Agricole     Gold MasterCard Credit Card",
    "5131" : {
        "from" : "02",
        "to" : "40",
        "issuer" : "FR     Europay France"
    },
    "513141" : "FR     Europay France Crédit Agricole     MasterCard Credit Card",
    "513142" : "FR     Europay France ",
    "513143" : "FR     Europay France Advanzia Bank     MasterCard Credit Card",
    "5131" : {
        "from" : "44",
        "to" : "99",
        "issuer" : "FR     Europay France Advanzia Bank"
    },
    "5132" : {
        "from" : "00",
        "to" : "03",
        "issuer" : "FR     Europay France"
    },
    "5132" : {
        "from" : "07",
        "to" : "21",
        "issuer" : "FR     Europay France"
    },
    "5132" : {
        "in" : ["24","25","99"],
        "issuer" : "FR     Europay France"
    },
    "5132" : {
        "from" : "30",
        "to" : "49",
        "issuer" : "FR     Europay France"
    },
    "5132" : {
        "from" : "50",
        "to" : "58",
        "issuer" : "FR     Europay France"
    },
    "5132" : {
        "from" : "61",
        "to" : "79",
        "issuer" : "FR     Europay France"
    },
    "5132" : {
        "from" : "83",
        "to" : "88",
        "issuer" : "FR     Europay France"
    },
    "5132" : {
        "from" : "90",
        "to" : "94",
        "issuer" : "FR     Europay France"
    },
    "5132" : {
        "from" : "96",
        "to" : "97",
        "issuer" : "FR     Europay France"
    },
    "5133" : {
        "in" : ["00","10","20","50"],
        "issuer" : "FR     Europay France"
    },
    "5134" : {
        "in" : ["00","11","12","13"],
        "issuer" : "FR     Europay France"
    },
    "513453" : "FR     BNP Paribas     MasterCard Credit Card",
    "5135" : {
        "from" : "00",
        "to" : "34",
        "issuer" : "FR     Europay France"
    },
    "513536" : "FR     Europay France BRED Banque Populaire     Affinity MasterCard Credit Card",
    "5135" : {
        "from" : "37",
        "to" : "70",
        "issuer" : "FR     Europay France"
    },
    "5136" : {
        "from" : "00",
        "to" : "23",
        "issuer" : "FR     Europay France"
    },
    "513624" : "FR     Europay France - Barclays Bank PLC     MasterCard Platinum",
    "5136" : {
        "from" : "25",
        "to" : "53",
        "issuer" : "FR     Europay France"
    },
    "5136" : {
        "from" : "62",
        "to" : "70",
        "issuer" : "FR     Europay France"
    },
    "5136" : {
        "in" : ["55","98","99"],
        "issuer" : "FR     Europay France"
    },
    "513691" : "RU     Russian Standard Bank, Russia     MasterCard Unembossed (Instant Issue)",
    "5137" : {
        "in" : ["00","04","07", "08", "10","11","12","13","14"],
        "issuer" : "FR     Europay France"
    },
    "5138" : {
        "from" : "00",
        "to" : "35",
        "issuer" : "FR     Europay France"
    },
    "513900" : "FR     Europay France ",
    "514011" : "US     Integra Bank ",
    "514012" : "US     CitiBank South Dakota ",
    "514013" : "US     Elgin First Credit Union ",
    "514015" : "US     Infibank ",
    "514016" : "US     Miramar First Credit Union ",
    "514017" : "US     Franklin Templeton Bank and Trust ",
    "5140" : {
        "from" : "19",
        "to" : "20",
        "issuer" : "US     Wells Fargo"
    },
    "514021" : "US     Juniper Bank     Now known as Barclays Bank PLC",
    "514022" : "US     Navy First Credit Union ",
    "514102" : "US     Park National Bank ",
    "514108" : "US     Paradigm Bank Texas ",
    "514253" : "US     EDS Employees First Credit Union ",
    "514700" : "Mascoma Savings Bank     Business Mastercard Debit Card",
    "514876" : "KR     CitiBank     Platinum MasterCard",
    "514889" : "US     Juniper Bank     Now known as Barclays Bank PLC",
    "514923" : "US     Chase Manhattan Bank USA ",
    "515854" : "RU     Citibank Citigold Debit Card ",
    "517644" : "US     Miramar First Credit Union ",
    "516010" : "PL     Polbank EFG     MasterCard Credit Card",
    "516029" : "CitiFinancial     Shell/CitiFinancial Europe MasterCard",
    "516300" : "AU     WestPac Banking Corporation ",
    "516310" : "AU     WestPac Banking Corporation ",
    "516315" : "AU     WestPac Banking Corporation ",
    "516319" : "AU     WestPac Banking Corporation     Virgin MasterCard Credit Card",
    "516361" : "AU     Westpac Banking Corporation     Visa Debit Card",
    "516331" : "RU     Svyaznoy Bank ",
    "516335" : "AU     WestPac Banking Corporation ",
    "516337" : "AU     WestPac Banking Corporation     Australia Platinum MasterCard",
    "5163" : {
        "in" : ["39","40","45", "48", "49","50","55","59","60","65","69","70","75","79","80","85","89"],
        "issuer" : "AU     WestPac Banking Corporation"
    },
    "517651" : "US     5-Star Bank ",
    "517652" : "HDFC Bank     MasterCard Gold Credit Card",
    "517669" : "US     HSBC     (formerly Household) MasterCard Credit Card",
    "517805" : "US     Capital One     MasterCard Credit Card or First Premier Bank",
    "517869" : "US     Union Bank     MasterCard Debit Card",
    "518126" : "Utility Warehouse     MasterCard PrePaid Card",
    "518127" : "CA     President's Choice Financial     MasterCard Credit Card",
    "518142" : "UK     MBNA     MasterCard[citation needed]",
    "518145" : "UK     Royal Bank of Scotland     Tesco Bank Classic MasterCard Credit Card",
    "518152" : "UK         Tesco Bank ClubCard MasterCard Credit Card",
    "518175" : "UK     MBNA     British Midland Airways MasterCard",
    "518176" : "IE     MBNA     MBNA Ireland Platinum MasterCard",
    "518791" : "Lloyds TSB     MasterCard CreditCard",
    "519000" : "CA     Bank of Montreal ",
    "519113" : "CA     Bank of Montreal ",
    "5191" : {
        "from" : "20",
        "to" : "23",
        "issuer" : "CA     Bank of Montreal"
    },
    "519129" : "CA     Bank of Montreal ",
    "519133" : "CA     Bank of Montreal ",
    "5191" : {
        "from" : "40",
        "to" : "43",
        "issuer" : "CA     Bank of Montreal"
    },
    "519154" : "CA     Bank of Montreal ",
    "5191" : {
        "from" : "61",
        "to" : "62",
        "issuer" : "CA     Bank of Montreal"
    },
    "519163" : "NZ     Kiwibank ",
    "519173" : "CA     Bank of Montreal ",
    "5191" : {
        "from" : "80",
        "to" : "83",
        "issuer" : "CA     Bank of Montreal"
    },
    "5192" : {
        "from" : "00",
        "to" : "02",
        "issuer" : "CA     Bank of Montreal"
    },
    "5192" : {
        "from" : "20",
        "to" : "23",
        "issuer" : "CA     Bank of Montreal"
    },
    "5192" : {
        "from" : "40",
        "to" : "42",
        "issuer" : "CA     Bank of Montreal"
    },
    "519244" : "AU     Bendigo Bank     Business Blue Debit Mastercard",
    "519259" : "CA     Bank of Montreal ",
    "519269" : "CA     Bank of Montreal     USD Mastercard",
    "519281" : "CA     Bank of Montreal ",
    "519283" : "CA     Bank of Montreal ",
    "519290" : "CA     Bank of Montreal ",
    "5192" : {
        "from" : "93",
        "to" : "94",
        "issuer" : "CA     Bank of Montreal"
    },
    "5193" : {
        "from" : "22",
        "to" : "23",
        "issuer" : "CA     Bank of Montreal"
    },
    "519332" : "CA     Bank of Montreal ",
    "519342" : "CA     Bank of Montreal ",
    "519371" : "CA     Bank of Montreal ",
    "519373" : "CA     Bank of Montreal ",
    "519381" : "CA     Bank of Montreal ",
    "519383" : "CA     Bank of Montreal ",
    "5193" : {
        "from" : "90",
        "to" : "91",
        "issuer" : "CA     Bank of Montreal"
    },
    "5193" : {
        "from" : "93",
        "to" : "95",
        "issuer" : "CA     Bank of Montreal"
    },
    "519400" : "CA     Bank of Montreal ",
    "519403" : "CA     Bank of Montreal ",
    "519409" : "CA     Bank of Montreal ",
    "5194" : {
        "from" : "30",
        "to" : "31",
        "issuer" : "CA     Bank of Montreal"
    },
    "5194" : {
        "from" : "33",
        "to" : "34",
        "issuer" : "CA     Bank of Montreal"
    },
    "519443" : "CA     Bank of Montreal ",
    "519463" : "PH     Banco De Oro     MasterCard Debit Card",
    "5194" : {
        "from" : "90",
        "to" : "91",
        "issuer" : "CA     Bank of Montreal"
    },
    "5194" : {
        "from" : "93",
        "to" : "94",
        "issuer" : "CA     Bank of Montreal"
    },
    "519520" : "Altair     Prepaid Cards",
    "519525" : "Contis Group &amp; EZPay     Prepaid Cards",
    "5195" : {
        "from" : "40",
        "to" : "44",
        "issuer" : "CA     Bank of Montreal"
    },
    "5122" : "First Gulf Bank",
    "5130" : "Banque Postale (France)",
    "5132" : "Crédit Mutuel MasterCard Credit Card (France)",
    "5135" : "BRED Banque Populaire MasterCard Credit Card",
    "5141" : "Banco Popular North America Mastercard Debit Card",
    "5148" : "US Airways Dividend Miles Platinum MasterCard",
    "5150" : "MetaBank MasterCard FSA debit card (issued on behalf of third-party administrators)",
    "5151" : "OboPay Prepaid Debit Card Issued By First Premier",
    "5155" : "Orchard Bank issued by HSBC",
    "5156" : "BestBuy MasterCard issued by HSBC (previously Household Bank)",
    "5176" : "China Minsheng Bank MasterCard Credit Card",
    "5177" : "BANAMEX Debit Card",
    "5179" : "Bank Atlantic Mastercard Debit Card",
    "5182" : "Banco Nacional de Costa Rica Servibanca Debit Card",
    "5185" : "HONGKONG AND SHANGHAI BANKING CORPORATION, LTD., THE MasterCard (HK)",
    "518652" : "ROYAL BANK OF SCOTLAND PLC. EUR GBR EDINBURGH",
    "5187" : "China Merchants Bank MasterCard Credit Card",
    "518996" : "UniCredit Bank, Russia",
    "51639" : "Westpac Australia Classic MasterCard",
    "200" : "MBNA Quantum MasterCard Credit Card",
    "520169" : "BestBuy MasterCard by Bank of Communications/HSBC (China)",
    "520306" : "Citibank/Lufthansa Miles &amp; More MasterCard Credit Card (Russia)",
    "520641" : "Tesco Bank Bonus Mastercard(UK)",
    "520988" : "Garanti Bank Shop&amp;Miles MasterCard Credit Card",
    "521324" : "Tinkoff Credit Systems (Russia), MasterCard Platinum Credit Card",
    "521326" : "SMP Bank (Russia), MasterCard Platinum Transaero Card",
    "5217" : "Commonwealth Bank of Australia Debit MasterCard",
    "521804" : "Tesco Bank Business Mastercard (UK)",
    "521853" : "PayPal MasterCard",
    "5221" : "MasterCard Credit Cards in South Africa",
    "522182" : "People's Trust (US)",
    "522223" : "Avangard Bank, Russia",
    "522276" : "Chase Manhattan Bank MasterCard Credit Card",
    "5228" : "Presidents Choice MasterCard Credit Card",
    "5232" : "Sparkasse Germany MasterCard Credit Card",
    "5234" : "Lufthansa Miles &amp; More MasterCard Credit Card",
    "523748" : "Commonwealth Bank of Australia Prepaid Travel Money Mastercard",
    "523911" : "Affinity Bank",
    "523912" : "Affinity Bank",
    "523951" : "ICICI Bank MasterCard Credit Card",
    "524040" : "OCBC Bank BEST-OCBC MasterCard Credit Card (Singapore)",
    "5243" : "Hudson's Bay Company MasterCard Credit Card (Canada)",
    "525241" : "Saison Card International, Japan - United Airlines Mileage Plus",
    "525405" : "VÚB Banka (Banca Intesa group) MasterCard original+ Credit card (Slovakia)",
    "5255" : "Mastercard CartaSi (Italy)",
    "5256" : "Sparda-Bank MasterCard Charge Card (Germany)",
    "525678" : "Banamex Debit card",
    "5258" : "Mastercard National Bank of Canada (Canada)",
    "525896" : "Mastercard Husky (Canada) [Husky/Mohawk MasterCard]",
    "5259" : "Canadian Tire Bank Cash Advantage Platinum MasterCard",
    "525995" : "Canadian Tire Bank Gas Advantage MasterCard",
    "5262" : "Citibank MasterCard Debit Card",
    "526219" : "Citibank MasterCard American Airlines AAdvantage Debit Card",
    "526224" : "Citibank MasterCard Debit Card",
    "5264" : "Bank Negara Indonesia MasterCard Debit Card",
    "526418" : "Vietcombank - Vietnam - MasterCard Debit Card",
    "526468" : "State Bank of India",
    "526471" : "POSBank MasterCard Debit/ATM Card (Singapore)",
    "526495" : "Bank of India MasterCard Debit/ATM Card",
    "526702" : "Yes Bank Mastercard Silver Debit Card (India)",
    "526722" : "Standard Bank South Africa MasterCard Credit Card (Gift Card)",
    "526781" : "VÚB Banka (Banca Intesa group) - MasterCard unembossed Credit card (Slovakia)",
    "526790" : "Asia Commercial Bank Vietnam - MasterCard Debit Card",
    "5268" : "Landesbank Berlin (Germany) MasterCard Credit Card",
    "5268" : "CitiBank Platinum Enrich (Canada) MasterCard Credit Card",
    "527434" : "Caixanova NovaXove (Spain) Mastecard Debit Card",
    "527455" : "Rubycard Pre-Paid Mastercard (Ireland) issued by Newcastle Building Society",
    "527456" : "WireCard Bank (Germany)",
    "5275" : "Sampo Bank (Finland) MasterCard Debit Card",
    "528013" : "Bankwest Australia MasterCard Debit Card",
    "528038" : "ING Bank N.V. Amsterdam",
    "528061" : "BMO Bank of Montreal MasterCard Prepaid Travel",
    "528093" : "Banesto (Spain) Mastercard Prepaid Sevilla Futbol Club",
    "528229" : "Nexpay prepaid card",
    "5286" : "Santander Cards",
    "5286" : "ABSA (Amalgamated Banks of South Africa) MasterCard Credit Card",
    "5286" : "Virgin Money South Africa (Virtual Bank; Operates partially on ABSA's system)",
    "528683" : "The Governor And Company Of The Bank Of Scotland EUR GBR DUNFERMLINE",
    "528689" : "Santander Zero MasterCard Credit Card UK",
    "5287" : "Washington Mutual Bank Debit card",
    "5289" : "ANZ (Previously RBS and ABN AMRO) Switch Platinum MasterCard Credit Card (Singapore)",
    "529480" : "Santander [CONTIGO] Credit Card (Spain)",
    "529580" : "(Italy) Kalixa Prepaid MasterCard (Vincento Payment Solutions)",
    "529930" : "Marks &amp; Spencer Money MasterCard Credit Card",
    "529962" : "Prepaid MasterCards issued by DCBANK. (MuchMusic)",
    "529964" : "Altair prepaid MasterCard",
    "529965" : "pre paid debit cards",
    "529966" : "pre paid debit cards",
    "5301" : "BarclayCard Mastercards.",
    "5303" : "BAC San José (Costa Rica) Debit card",
    "530343" : "Net1 Virtual Card Prepaid",
    "530695" : "Bancolombia Prepaid MasterCard Credit Card (E-prepago)",
    "530785" : "Sears MasterCard issued by [Chase Cards Canada]",
    "530831" : "Orange Cash Prepaid MasterCard, issued by Orange and Barclays with PayPass",
    "531207" : "Uralsib Bank (Russia), MasterCard World - Aeroflot bonus",
    "531306" : "Moneybookers.com Prepaid Mastercard issued by Newcastle Building Society",
    "531355" : "National Bank MasterCard Credit Card",
    "5316" : "CUETS Financial Canada MasterCard Credit Card",
    "5317" : "CUETS Financial Canada Global Payment MasterCard",
    "5322" : "Washington Mutual Business Debit card",
    "532450" : "China Construction Bank Credit Card",
    "532561" : "HSBC Bank USA Premier Debit Mastercard with PayPass",
    "5327" : "Dexia banka Slovensko, a.s.; MasterCard credit PayPass",
    "532700" : "RBS Premium MasterCard Debit Card",
    "5329" : "MBNA Preferred MasterCard Credit Card",
    "532902" : "Wachovia Bank MasterCard Credit Card",
    "533157" : "RNKO, Euroset Kukuruza Bonus (Russia) Mastercard Unembossed, Instant Issue",
    "533206" : "Avangard Bank MasterCard Credit Card",
    "533248" : "Comerica Bank Mastercard prepaid",
    "533838" : "[CBA] Prepaid Gift card as MasterCard",
    "533846" : "Kalixa Prepaid Mastercard UK Kalixa Prepaid MasterCard (Vincento Payment Solutions)",
    "533875" : "Paypal Italy MasterCard Prepaid",
    "533896" : "Paypal Access Card (UK)",
    "533908" : "Bank Zachodni WBK Mastercard Premium Prepaid PayPass (Electronic) (Poland)",
    "533936" : "Kalixa Prepaid Mastercard DE Kalixa Prepaid MasterCard (Vincento Payment Solutions)",
    "535316" : "Commonwealth Bank Standard MasterCard Credit Card",
    "535317" : "Commonwealth Bank Credit Card",
    "535318" : "Commonwealth Bank Gold MasterCard Credit Card",
    "536386" : "Barclaycard World Mastercard (UK)",
    "537004" : "RNKO, Russia, Svyaznoy MasterCard Unembossed Card Instant Issue",
    "538720" : "BC Mastercard issued by Woori Bank",
    "538803" : "BC Mastercard issued by Industrial Bank of Korea",
    "538806" : "BC Mastercard issued by Kookmin Bank",
    "538811" : "BC Mastercard issued by Nonghyup Central Bank",
    "538812" : "BC Mastercard issued by Nonghyup Local Banks",
    "538820" : "BC Mastercard",
    "538823" : "BC Mastercard issued by SC First Bank",
    "538825" : "BC Mastercard issued by Hana Bank",
    "538827" : "BC Mastercard issued by Citibank in Korea",
    "538878" : "BC Mastercard issued by Shinhan Bank",
    "539028" : "Citibank Mastercard (Brazil)",
    "5396" : "Saks Fifth Avenue World Elite MasterCard issued by HSBC",
    "539673" : "Avangard Bank, MasterCard World Signia Card",
    "5399" : "ICICI Bank MasterCard debit Card",
    "540034" : "Standard Chartered Bank Titanium Credit Card (Hong Kong)",
    "540002" : "DBS (Esso co-branded) Singapore",
    "5401" : "Bank of America (formerly MBNA) MasterCard Gold Credit Card",
    "540141" : "BANESCO Classic Mastercard card (Venezuela).",
    "540168" : "Chase MasterCard Credit Card",
    "540221" : "ANZ National Bank ANZ MasterCard Credit Card",
    "540223" : "Westpac New Zealand MasterCard Credit Card",
    "540207" : "BNZ (Bank of New Zealand) Global Plus MasterCard Credit Card",
    "5403" : "Citibank MasterCard Credit Card (&quot;Virtual Card&quot; number)",
    "5404" : "Lloyds TSB Bank MasterCard Credit Card",
    "540410" : "Brown Thomas MasterCard (Issued by AIB)",
    "540450" : "Advanced Payment Solutions (APS)",
    "540451" : "Advanced Payment Solutions (APS)",
    "5406" : "Bancolombia MasterCard Credit Card (Colombia)",
    "5407" : "HSBC Bank GM Card",
    "540758" : "MBNA Bank UK bmi Blue Mastercard",
    "5409" : "HSBC Bank, Union Bank of California Pay Pass debit card",
    "540801" : "Household Bank USA MasterCard Credit Card",
    "540806" : "Hang Seng Bank Credit Card",
    "540838" : "BOC Great Wall Credit Card (CN)",
    "540877" : "Bank of China Platinum MasterCard Credit Card (SG)",
    "541010" : "Raiffeisen Zentralbank",
    "541065" : "Citibank MC",
    "541142" : "CIBC MasterCard (Canadian Imperial Bank of Commerce) formerly Citi MasterCard Canada",
    "5412" : "HSBC Malaysia issued Mastercard",
    "541206" : "USAA",
    "541256 02" : "SEB Kort AB, Choice Club credit card (SE)",
    "541256 50" : "SEB Kort AB, SJ Prio credit card (SE)",
    "541277" : "Nordea Finance/Valutakortet Valuta MasterCard credit card (SE)",
    "541330" : "Mastercard test BIN for NIV, TIP certifiction (not production cards)",
    "541592" : "Neteller (UK) Mastercard debit card",
    "5416" : "Washington Mutual (formerly Providian) Platinum MasterCard Credit Card",
    "541606" : "WestJet/RBC Royal Bank of Canada MasterCard (Canada)",
    "541657" : "(eBay MasterCard) via Providian",
    "5417" : "Chase Bank",
    "5420" : "MasterCard issued by USAA, Mastercard issued by John Lewis (Partnership Card)",
    "5424" : "Citibank MasterCard Credit Card (Dividend, Diamond and others)",
    "542418" : "Citibank Platinum Select",
    "5425" : "Barclaycard MasterCard Credit Card (Germany)",
    "542505" : "RBS Gold Mastercard Credit Card (formerly ABN Amro Bank) (India)",
    "542523" : "Allied Irish Banks MasterCard Credit Card (Ireland)",
    "54254200" : "GE Money Bank Mastercard debit card (SE)",
    "54254207" : "GE Money Bank Mastercard credit card (SE)",
    "542598" : "Bank of Ireland Post Office Platinum Card (UK)",
    "5426" : "Alberta Treasury Branch",
    "5430" : "ANZ Bank MasterCard",
    "5430" : "Stockmann Department Store Mastercard, issued by Nordea (Finland)",
    "543034" : "Stockmann Department Store Exclusive Mastercard, issued by Nordea (Finland)",
    "543077" : "Handelsbanken Business Mastercard (Sweden)",
    "543122" : "HSBC issued Mastercard (Hong Kong)",
    "543250" : "Bank of New Zealand MasterCard Credit Card",
    "543267" : "Bank of Ireland MasterCard Credit Card",
    "5434" : "MasterCard credit cards from UK and Irish banks",
    "543429" : "Halifax 'One' Mastercard",
    "543458" : "HSBC UK Premier Credit Card",
    "543460" : "HSBC Mastercard Credit Card (UK)",
    "543478" : "National Irish Bank Mastercard",
    "543479" : "National Irish Bank Gold Mastercard",
    "543556" : "NatWest Mastercard Charge Card",
    "543678" : "Westpac New Zealand Mastercard Gold Credit Card",
    "543482" : "RBS Mastercard Credit Card",
    "543696" : "Itau Mastercard Credit Card",
    "543699" : "NatWest MasterCard Gold Credit Card",
    "5437" : "St George Bank Credit Card (Australia)",
    "5438" : "USAA Federal Savings Bank",
    "5440" : "Mastercard from MBF Malaysia",
    "544156" : "Allied Irish Banks Gold MasterCard Credit Card",
    "5442" : "HSBC Mastercard Credit Card (Singapore)",
    "544258" : "BRE Bank (MultiBank) Mastercard Aquarius PayPass Credit Card (Black)(Poland)",
    "544291" : "Kiwibank Go Fly MasterCard Standard (NZ)",
    "5443" : "HSBC MasterCard Debit Card with PayPass (USA)",
    "5444" : "Bangkok Bank (Thailand)",
    "5444" : "BHW MasterCard Charge Card (Germany)",
    "544434" : "Wizard Clear Advantage MasterCard (Australia)",
    "544440" : "Valovis Bank, Prepaid MasterCard Debit(Germany)",
    "5446" : "Canadian Tire MasterCard Credit Card",
    "544748" : "Chase SLATE MasterCard Credit Card",
    "544917" : "Citizens Bank (Personal Checking) Debit",
    "545045" : "Danske Bank Intercard MasterCard debit card (SE)",
    "5451" : "NatWest Mastercard Credit Card",
    "545157" : "Masterbank (Russia), MasterCard World Signia",
    "5452" : "MBNA Canada Mastercard",
    "545250" : "Maestro (debit card) BZWBK Poland",
    "54546?" : "Natwest Student Mastercard (UK)",
    "5455" : "BancorpSouth Mastercard MasterMoney Debit Card",
    "545511" : "Masterbank (Russia) MasterCard Gold Debit Card",
    "545578" : "Halifax MasterCard (UK)",
    "5457" : "Capital One Canada Branch",
    "5457" : "Dexia banka Slovensko, a.s.; Mastercard Gold with PayPass technology",
    "5458" : "USAA Credit Card",
    "5459" : "Harris Bank Debit Card",
    "545955" : "Mascoma Savings Bank Mastercard Consumer Debit Card",
    "5460" : "Berliner Bank (Germany),Mint MasterCard Credit Card and Capital One UK",
    "546259" : "The Governor And Company Of The Bank Of Ireland EUR IRL DUBLIN 2",
    "546286" : "Dexia banka Slovensko,a.s.; MasterCard Red with PayPass technology",
    "5466" : "Citibank, MBNA &amp; Chase World MasterCard Credit Cards,",
    "546604" : "First USA Banke, N.A. Master Card",
    "546641" : "HSBC GM MasterCard Credit Card",
    "546680" : "HSBC GM MasterCard Credit Card",
    "5469" : "Sberbank of Russia",
    "547046" : "Santander Uni-k Credit Card (México)",
    "5471" : "Davivienda MasterCard Credit Card (Colombia)",
    "547343" : "ANZ Business MasterCard (New Zealand)",
    "547347" : "HSBC Commercial Card (UK in £)",
    "547356" : "RBS Royal Bank of Scotland",
    "547367" : "NatWest (RBS)",
    "547372" : "Swedbank, Estonia, MasterCard Business Card",
    "5474" : "Wells Fargo Bank BusinessLine credit card (US)",
    "548009" : "Fifth Third Bank",
    "548045" : "BANCO BRADESCO S.A. (BRAZIL)",
    "5483" : "HypoVereinsbank (Germany)",
    "548652" : "Banco de Chile Master Card Credit Card",
    "548653" : "Banco de Chile Master Card Credit Card RUA",
    "548673" : "Alfa-Bank/Aeroflot-bonus, M-Video bonus debit Card (Russia)",
    "548674" : "Alfa-Bank Credit Card (Russia)",
    "548805" : "Hatton National Bank, Sri Lanka RUA",
    "548901" : "Banco Santander MasterCard debit card (Spain)",
    "548912" : "Banco Santander MasterCard debit card with chip (Spain)",
    "548955" : "HOUSEHOLD BANK (NEVADA), N.A, (Orchard Bank M/C, HSBC Card Services) RUA",
    "54896" : "Industrial and Commercial Bank of China (ICBC) Peony American Express Gold Card China",
    "5490" : "MBNA &amp; Chase Platinum MasterCard Credit Cards",
    "549035" : "MBNA American Bank [Now part of Bank of America]",
    "549099" : "MBNA American Bank [Now part of Bank of America]",
    "5491" : "AT&amp;T Universal MasterCard Credit Card, now part of Citibank, also MBNA MasterCard Credit Cards",
    "549104" : "Chase Manhattan Bank USA, N.A.",
    "549110" : "HSBC Bank Nevada, N.A. issued Household Bank Platinum Mastercard",
    "549113" : "Citibank MC",
    "549123" : "USAA Federal Savings Bank Platinum",
    "549409" : "HSBC Bank Nevada, NA Premier World Mastercard (credit card)",
    "549471" : "Qantas Woolworths Everyday Mastercard (issued by HSBC)",
    "540041" : "HSBC Bank Gold Malaysia",
    "550619" : "&quot;Skycard&quot; MasterCard Credit Card issued in UK in association with Barclaycard",
    "551128" : "ITS Bank/SHAZAM (Interbank Network) Mastercard USA unclear if Debit or Credit",
    "551167" : "ITS Bank/SHAZAM (Interbank Network) Mastercard USA unclear if Debit or Credit",
    "551445" : "Cambridge Trust Company in Massachusetts, USA",
    "5520" : "DBS POSB Everyday Platinum Mastercard (Singapore) / Bank of Scotland Private Banking Platinum MasterCard / RBS World Mastercard",
    "552016" : "Bank of China International MasterCard Platinum (Hong Kong area)",
    "552033" : "Commonwealth Bank Platinum Awards MasterCard Credit Card",
    "552038" : "POSB (DBS Bank) everyday Platinum MasterCard Credit Card",
    "552093" : "Citibank Mastercard Platinum Credit Card (India)",
    "5521" : "BC Platinum Mastercard",
    "552157" : "Lloyds TSB Platinum Mastercard",
    "552188" : "Tesco Bank Finest Platinum Mastercard (UK)",
    "5522" : "NatWest Platinum Mastercard",
    "552213" : "NatWest Platinum Mastercard",
    "5523" : "MBNA Smart Cash World MasterCard (Canada)",
    "5524" : "Bank Of Montreal World Elite MasterCard (Canada)",
    "55456789020" : "BC Card",
    "552724" : "Danske Bank MasterCard Direkt debit card (SE)",
    "5528" : "Diner's Club",
    "553421" : "Bank of Scotland Mastercard",
    "553823" : "MIT Federal Credit Union Debit Mastercard",
    "553877" : "Star Processing PrePaid Mastercard",
    "553985" : "First National Bank in Edinburg, USA",
    "554346" : "Kookmin Bank Mastercard &quot;Free Pass&quot; Debit Card",
    "554544" : "Bank of Ireland",
    "554564" : "Onyxcard",
    "554619" : "Citibank Mastercard Silver Credit Card (India)",
    "554641" : "Euro Kartensysteme Eurocard und Eurocheque gmbh",
    "554827" : "POSBank MasterCard Debit Card (Singapore)",
    "555005" : "Commonwealth Bank of Australia Corporate Mastercard",
    "556951" : "Nat West Bank Mastercard",
    "557098" : "Aqua Card Mastercard (UK)",
    "5573" : "Metro Bank MasterCard Debit Card",
    "557505" : "Bank Handlowy Mastercard Electronic Pay Pass (Karta Miejska) Debit Card (Poland)",
    "557510" : "BRE Bank (MultiBank) Mastercard Aquarius PayPass Debit Card(Poland)",
    "557513" : "BRE Bank (MultiBank) Mastercard PayPass Debit Card(Poland)",
    "557552" : "Ally Bank Platinum Debit Card",
    "557843" : "&quot;Goldfish&quot; MasterCard Credit Card issued in UK by Morgan Stanley",
    "557892" : "MasterCard Credit Card issued in Nordea Denmark",
    "557905" : "Santander Mexico Debit Card",
    "557907" : "Santander Mexico Debit Card",
    "558108" : "Citizens Bank (Business Checking) Debit",
    "558158" : "Paypal MasterCard Debit Card, JPMorgan Chase Bank, Formerly Bank One",
    "5588" : "[Citibank] MasterCard Credit Card &quot;Business&quot;",
    "558818" : "[Hdfc Bank] MasterCard Credit Card &quot;Business Platinum&quot; India",
    "558846" : "FIA",
    "560017" : "Comdata Card",
    "560054" : "HSBC Bank USA, N.A. Maestro card",
    "560279" : "Commonwealth Bank of Australia Key Card",
    "560373" : "Alliance and Leicester cash deposit card",
    "561059" : "Australian Bank Card",
    "561066" : "HSBC Bank Canada ATM Card",
    "561150" : "Chase (USA), ATM Card",
    "564100" : "Santander UK cash card",
    "564104" : "Nationwide",
    "564120" : "Nationwide Cashbuilder ATM card.",
    "564182" : "Switch (debit card) Debit Card",
    "565659" : "Banco Santander Ferrari MasterCard credit card (Spain)",
    "574085" : "Banco Santander Puerto Rico ATM/debit card",
    "581353" : "Vancity ATM Card",
    "581828" : "Credit Union (Ontario) debit cards",
    "585048" : "Suntrust Banks - ATM Card",
    "585210" : "Citibank Greece ATM Card",
    "586357" : "Branch Banking and Trust (BB&amp;T) ATM Card",
    "587781" : "Bank of America ATM Card",
    "589297" : "TD Canada Trust Interac/ATM Card",
    "589562" : "TARJETA NARANJA (Argentina)",
    "588644" : "Citibank Korea International ATM Card",
    "589242" : "National Bank of Greece Greece Debit Card",
    "589261" : "Maestro (debit card) Pekao",
    "589460" : "'Choice Card', issued by HSBC, for the Cold Storage chain",
    "589732" : "Digital TV Converter Box $40.00 Coupons (USA) - DTV2009.GOV",
    "5898" : "All Korean Banks ATM/DEBIT Card",
    "589856" : "Standard Chartered Bank (Hong Kong) ATM Card",
    "5899" : "MCB",
    "600229" : "Wegmans Shoppers Card",
    "600292" : "Hudson's Bay Company",
    "600293" : "Hudson's Bay Company",
    "600294" : "Hudson's Bay Company",
    "600315" : "Safeway",
    "600649" : "Fastcard Gift Cards",
    "601056" : "ValueLink stored value card (Starbucks, Borders Books, et al.)",
    "601021" : "ARI Canada - Ontario government",
    "6011" : "Discover Card Credit Card",
    "6012" : "BANESCO (former BancUnion) Maestro Debit card",
    "601382" : "Bank of China Unionpay Debit card (GreatWall Debit Card)",
    "6016" : "Bancolombia",
    "601725" : "ING Direct Canada ATM Card",
    "601859" : "A GAP card that carries GAP, Banana Republic and Old Navy logos, issued by GE Money Bank.",
    "601887" : "President's Choice Financial Canada Debit Card (ATM/Interac)",
    "6019" : "Brandsmart USA Credit Card",
    "602700" : "Wichita State University &quot;Shocker Card&quot; (a stored value card)",
    "602969" : "CN Bank of Beijing Debit Card Visa Interlink/China UnionPay CNY",
    "603207" : "Shoppers Drug Mart Optimum Program",
    "603220" : "Walmart Credit Card",
    "603367" : "(CN) Bank of Hangzhou Debit Card, China UnionPay",
    "603411" : "Palm Desert National Bank, USA (IKobo.com Money-transfer debit card)",
    "603450" : "Starbucks Card (Starbucks Europe Ltd)",
    "6035" : "Citibank (Home Depot) Card",
    "603528" : "STAPLES Canada Enterprise Credit Card (issued by Citi Cards Canada)",
    "603692" : "Stockmann Card",
    "603753" : "McDonald's Gift Card (serviced by ValueLink)",
    "603798" : "KiwiBank Debit Card (Cirrus)",
    "603948" : "OBI Petrol Card",
    "6041" : "Walmart Canada Gift Card",
    "6044" : "Ikea Credit Card (issued by Citi Cards Canada)",
    "6045" : "Lowes (Canada) (issued by GE Money Canada)",
    "604646" : "Scene LP (Cineplex Entertainment)",
    "604767" : "More Rewards (Overwaitea Food Group loyalty card, BC and AB, Canada)",
    "604809" : "Svyaznoy Club loyalty card",
    "604976" : "Tim Hortons QuickPay Tim Card",
    "6051" : "Starbucks Card - USA &amp; Canada",
    "6060" : "Shinhan Card",
    "606095" : "Starbucks Card - Europe",
    "606172" : "Club Sobeys (Canada)",
    "606179" : "Commonwealth Finance Solutions Ltd",
    "606263" : "MoneyTech Inc. - Brazil",
    "606469" : "Revolution MoneyExchange",
    "606484" : "PRJ Financial Services - Karum Group LLC",
    "606934" : "Starbucks Card - Korea",
    "607120" : "Starbucks Card - Korea",
    "620013" : "Bank of Communications Hong Kong Branch Expo 2010 Shanghai China CUP Gift Card (HK)",
    "620021" : "Bank of Communications Expo 2010 Shanghai China Prepaid Card (China)",
    "621019" : "Zheshang Bank Debit Card (CN)",
    "621041" : "Bank of China (Hong Kong) BOC Card - Debit (HK)",
    "621060" : "Woori Bank UnionPay Shanghai Tourism Card (CN)",
    "622141" : "Zhejiang Tailong Commercial Bank Debit Card (CN)",
    "622200" : "CN ICBC Peony Money Link Card",
    "622201" : "CN ICBC Peony Money Link Card",
    "622202" : "CN ICBC Peony Money Link Card E-Age",
    "622203" : "CN ICBC Peony Money Link Card E-Age",
    "622208" : "CN ICBC Elite Club Account Card",
    "622210" : "CN ICBC Peony Quasi-Credit Card",
    "622212" : "Chong Hing Bank China Unionpay Gift Card (HK)",
    "622226" : "Bank of Communications Pacific Card Debit Card",
    "622252" : "BestBuy UnionPay Credit Card by Bank of Communications/HSBC",
    "622260" : "Bank of Communications Expo 2010 Shanghai China CUP Special Edition Debit Card (CN)",
    "622372" : "The Bank of East Asia UnionPay Dual Currency Platinum Credit Card (HK)",
    "622309" : "Zheshang Bank Debit Card (CN)",
    "622379" : "Qilu Bank  Debit Card (CN)",
    "622381" : "CCB (Asia) CUP Credit Card (HK)",
    "622409" : "Hang Seng Bank Green Banking Smart Card - Debit (HK)",
    "622410" : "Hang Seng Bank Hang Seng Card - Debit (HK)",
    "622427" : "Taizhou Bank DaTang Debit card (CN)",
    "622492" : "DBS Octopus ATM Card - Debit (HK)",
    "6225" : "Shanghai Pudong Development Bank UnionPay",
    "622568" : "Guangdong Development Bank Debit(China UnionPay) Card (CN)",
    "622630" : "China Huaxia Bank Debit card, China Unionpay(CN)",
    "6226313" : "China Huaxia Bank Debit card, China Unionpay(CN)",
    "622632" : "China Huaxia Bank Debit card, China Unionpay(CN)",
    "622633" : "China Huaxia Bank Debit card, China Unionpay(CN)",
    "622659" : "CHINA EVERBRIGHT BANK Debit and Credit All in One Card (CN)",
    "622700" : "China Construction Bank Debit(China UnionPay) Card (CN)",
    "622752" : "Bank of China China UnionPay Credit Card (CN)",
    "622789" : "Bank of China China UnionPay Platinum Credit Card (SG)",
    "622933" : "Bank of East Asia UnionPay Debit Card (HK)",
    "622942" : "Standard Chartered UnionPay Debit Card (HK)",
    "622974" : "AEON Prepaid UnionPay Card (HK)",
    "625008" : "Chong Hing Bank UnionPay Dual Currency Credit Card (HK)",
    "625028" : "Bank of Communications Hong Kong Branch UnionPay Dual Currency Diamond Credit Card (HK)",
    "625029" : "Bank of Communications Hong Kong Branch UnionPay Dual Currency Gold Credit Card (HK)",
    "625040" : "Bank of China (Hong Kong) UnionPay Dual Currency Gold Credit Card - HKD Account (HK)",
    "625041" : "Bank of China (Hong Kong) UnionPay Dual Currency Gold Credit Card - CNY Account (HK)",
    "625042" : "Bank of China (Hong Kong) UnionPay Dual Currency Platinum Credit Card - HKD Account (HK)",
    "625043" : "Bank of China (Hong Kong) UnionPay Dual Currency Platinum Credit Card - CNY Account (HK)",
    "625063" : "Wing Lung Bank UnionPay Dual Currency Platinum Credit Card (HK)",
    "6253" : "BC Card CUP Credit Card[6]",
    "627397" : "Wild Oats Gift Card",
    "627421" : "Aeroplan (Air Canada)",
    "627425" : "Disney Rewards Card (issued by Chase)* ",
    "627692" : "Dexit",
    "6277" : "iCard (issued by ICICI Bank Canada)",
    "627895" : "virtual money inc",
    "628181" : "Sears Card (issued by Chase Cards Canada)",
    "630490" : "Bank of Ireland Laser/Maestro debit card",
    "630495" : "National Irish Bank Laser/Maestro debit card",
    "630499" : "permanent tsb Laser/Maestro debit card",
    "63191" : "British Home Stores - Bhs credit card",
    "633174" : "Co-operative membership card",
    "6333" : {
        "from" : "00",
        "to" : "49",
        "issuer" : "Maestro Cards"
    },
    "6334" : {
        "from" : "50",
        "to" : "99",
        "issuer" : "Solo Cards"
    },
    "633513" : "Midlands Co-operative Society membership card",
    "633540" : "Argos Card",
    "633625" : "National Savings &amp; Investments (UK)",
    "633641" : "Post Office Card Account card",
    "633675" : "G-T-P Group Ltd Payment Card",
    "633676" : "HMV Gift Card",
    "633698" : "G-T-P Group Ltd Prepaid Card",
    "633791" : "Commonwealth Finance Solutions Ltd",
    "633834" : "Debenhams Store Card by Santander Plc",
    "633845" : "Subway Subcard (UK)",
    "634001" : "Tesco Personal Finnace",
    "634004" : "Tesco Clubcard",
    "634005" : "Tesco Fuelcard",
    "634008" : "Tesco Personal Finnace",
    "634009" : "Tesco Tesco Clubcard (Poland)",
    "635608" : "Origin Compower",
    "635629" : "Origin Compower",
    "63563" : "Ventura",
    "6356500" : "Harrods",
    "6360" : "BC Card",
    "636325" : "Sahand Samaneh Mahpa Co Loyalty Card (IR)",
    "636587" : "Worldstar Freedom Plus Card issued by Worldstar Freedom Plus Limited",
    "639231" : "Comprocard (Comprocard)",
    "639300" : "Malina loyalty card (RU)",
    "6541" : "KR     BC Card     BC Global",
    "6556" : "KR     BC Card     BC Global",
    "6660" : "Citibank ATM Card (Hong Kong)",
    "670695" : "Allied Irish Banks Maestro/Laser card (IRL)",
    "6709" : "[[Laser (debit card)|Laser Debit Card] IRL]",
    "6718" : "RBS Cashline ATM Cards, Cirrus Branded",
    "672" : "girocard Debit Cards (Germany)",
    "673" : "Debit Cards (the Netherlands)",
    "6759" : "VARIOUS BANKS (UK) - Maestro (formerly Switch) debit cards",
    "675922" : "Clydesdale Bank Maestro debit card",
    "675940" : "HSBC (UK) Maestro Debit card",
    "675964" : "RBS Maestro Debit Card, with £100 Cheque Guarantee",
    "675967" : "NatWest Maestro Debit Card, with £100 Cheque Guarantee",
    "675968" : "NatWest Maestro Debit Card, with £250 Cheque Guarantee",
    "6761" : "Maestro debit card",
    "676165" : "Maestro debit card - CSOB Bank (CZ)",
    "676280" : "Maestro debit card - Sberbank (RU)",
    "676378" : "BZ-WBK (PL) - Maestro PayPass",
    "676398" : "ING Bank Slaski (PL) - Maestro PayPass",
    "676481" : "HSBC Bank (Turkey) - Maestro debit card",
    "676509" : "GENERALI BANK (IT) - Maestro debit card",
    "676613" : "Citibank (PL) - Maestro debit card",
    "6767" : "VARIOUS BANKS (UK) - Solo; xx indicates the bank in the UK national sort code system.",
    "676953" : "Pekao (PL) - Maestro debit card",
    "676969" : "Eurobank EFG (GR) - Maestro debit card",
    "6771" : "VARIOUS BANKS - Laser debit card",
    "677310" : "Garantibank (RO)",
    "677518" : "SMP Bank (Russia) - Moscow Metro Express Card/Maestro debit card",
    "677574" : "Intesa SanPaolo - Maestro debit card",
    "677594" : "Alior Bank (PL) - Maestro debit card",
    "690149" : "IAPA Frequent Flyers Card",
    "7001" : "Best Buy Credit Card (private-label card issued by HSBC Bank Nevada)",
    "700247" : "Priority Pass Passenger Card",
    "7021" : "Best Buy Credit Card (private-label card issued by HSBC Bank Nevada)",
    "7069" : "Petro-Canada (Petro-Points loyalty program)",
    "778900" : "Perekrestok X5Club loyalty program, Russia",
    "926366" : "Kaubamaja/Selver Parnerkaart, Estonia",
    "923362" : "Swedbank, Estonia, Temporary (30 day) ATM Card",
    "9280" : "BSW Bonus Card (www.bsw.de)"
};
module.exports = CreditSwipe;
module.exports.Scanner = ScanBuffer;
module.exports.types = Keyboard.Sequence.types;
module.exports.generate = function(type, options){
    if(!options) options = {};
    var get = function(name){
        if(options[name]) return options[name];
        else{
            var result = module.exports.generate(name, options);
            options[name] = result;
            return result;
        }
    };
    switch(type){
        case 'account':
            var luhn = require("luhn").luhn;
            var keys = prime.keys(Keyboard.Sequence.types);
            var size = keys[Math.floor(Math.random()*keys.length)];
            var options = Keyboard.Sequence.types[size];
            var number = '';
            prime.random(options, function(item, prefix){
                number = prefix;
            });
            while(number.length < size){
                number += ''+Math.floor(Math.random()*10);
            }
            while(!luhn.validate(number)) number = (parseInt(number)+1)+'';
            return number;
            break;
        case 'expiration':
            return '1504';
        case 'list_name':
            return 'Ed Beggler';
        case 'track_one':
            return '%B'+get('account')+'^'+get('list_name').toUpperCase()+'^'+get('expiration')+'333'+'333333' /* 'A', 'BBB' or 'CCCC'*/ +'?';
        case 'track_two':
            return ';'+get('account')+'='+get('expiration')+'333'+'333333' /* 'A', 'BBB' or 'CCCC'*/ +'?';
        case 'track_data' :
            return [
                get('track_one'),
                get('track_two')
            ]
        default : return 'blah';
        
    }
};
module.exports.stdIn = function(){
    process.stdin.setRawMode();
    process.stdin.resume();
    process.stdin.on('data', function (chunk, key) {
        chunk = chunk.toString();
        for(var lcv=0; lcv < chunk.length; lcv++){
            if(internalScanner) internalScanner.input(chunk[lcv]);
        }
        if (key && key.ctrl && key.name == 'c') process.exit();
    });
    return CreditSwipe;
}
module.exports.fake = function(scanner, options){
    var tracks = module.exports.generate('track_data', options);
    tracks.forEach(function(track){
        for(var lcv=0; lcv < track.length; lcv++){
            scanner.input(track[lcv]);
        }
    });
}