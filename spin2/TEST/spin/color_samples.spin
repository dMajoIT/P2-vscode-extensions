CON
  _clkmode = xtal1 + pll16x
  _xinfreq = 5_000_000

    NEW_COG = 15    ' 8 to 15 do same thing

OBJ
    color                       : "isp_hub75_color"
    digit[color.NBR_DIGITS]     : "isp_hub75_7seg"

PUB main(bDoNothing) : ok | idx
    if bDoNothing
        bDoNothing := TRUE ' yep we're doing nothing

    coginit(NEW_COG, @pasm_program,0)           'start another cog with a PASM program (another debugger will open)

    repeat        'keep looping while incrementing a variable
        idx++

PRI testMethod(param1) : bStatus | index
    index := 0
    bStatus := param1 + index + 1
    result = bStatus

VAR
    LONG  simpleVar[2]

DAT ' no pasm
    myString    byte    "test string",0
    effs        byte    $ff[8]

DAT ' with pasm
                org
pasm_program                                        ' do a DEBUG at the start of the program to open debugger
.loop           add     par,#1                      ' select "MAIN" in the debugger to single-step
                sub     testVariable,#2         wc
    if_c        jmp     #.loop

:loop2          add     par,#1                      ' select "MAIN" in the debugger to single-step
                sub     testVariable,#2
                jmp     #:loop2

testVariable   long  0[12]                          ' fill with some NOP's to make it easy to see the code above
spaceAlloc      res 1
filedata       FILE "test.txt"

                fit
