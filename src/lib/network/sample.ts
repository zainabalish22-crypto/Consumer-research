/** A small edge list for trying the tool. Accounts are invented handles. Includes a reversed
 *  duplicate, a self-loop, a blank endpoint and a weight that is not a number, so the checks show. */
export const sampleEdgesCsv = `source,target,weight
acc_ayla,acc_noor,3
acc_noor,acc_ayla,2
acc_ayla,acc_rami,1
acc_rami,acc_hana,4
acc_hana,acc_ayla,1
acc_hana,acc_samir,2
acc_samir,acc_samir,1
,acc_noor,1
acc_noor,acc_dina,
acc_dina,acc_rami,1,5
acc_dina,acc_omar,2
acc_omar,acc_hana,n/a
acc_tala,acc_omar,1
`;
