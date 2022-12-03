'' =================================================================================================
''
''   File....... test_notSpin1.spin2
''   Purpose.... File in numbered series of test files used to verify syntax highlighting
''   Authors.... Stephen M Moraco
''               -- Copyright (c) 2022 Iron Sheep Productions, LLC
''               -- see below for terms of use
''   E-mail..... stephen@ironsheep.biz
''   Started.... Dec 2022
''   Updated.... 1 Dec 2022
''
'' =================================================================================================

'' this is our full PASM2 instruction set

PUB null()

    '' This is NOT a top level object


DAT
' CON DECLARATIONS
' PASM ONLY!  Use ASMCLK? See SPIN DOC P28
                _clkfreq
                _rcfast
                _rcslow
                _xinfreq
                _xtlfreq


                ' alignment
                ALIGNL
                ALIGNW

                BYTE
                WORD
                LONG

name            BYTE    0[23]

                ' assembly start
                ORG
                ORGF
                ORGH


                ' registers
                PR0
                PR1
                PR2
                PR3
                PR4
                PR5
                PR6
                PR7
                IJMP1
                IJMP2
                IJMP3
                IRET1
                IRET2
                IRET3
                PA
                PB
                PTRA
                PTRB
                DIRA
                DIRB
                OUTA
                OUTB
                INA
                INB

                ' instructions
                ABS
                ADD
                ADDCT1
                ADDCT2
                ADDCT3
                ADDPIX
                ADDS
                ADDSX
                ADDX
                AKPIN
                ALLOWI
                ALTB
                ALTD
                ALTGB
                ALTGN
                ALTGW
                ALTI
                ALTR
                ALTS
                ALTSB
                ALTSN
                ALTSW
                AND
                ANDN
                AUGD
                AUGS
                BITC
                BITH
                BITL
                BITNC
                BITNOT
                BITNZ
                BITRND
                BITZ
                BLNPIX
                BMASK
                BRK
                CALL
                CALLA
                CALLB
                CALLD
                CALLPA
                CALLPB
                CMP
                CMPM
                CMPR
                CMPS
                CMPSUB
                CMPSX
                CMPX
                COGATN
                COGBRK
                COGID
                COGINIT
                COGSTOP
                CRCBIT
                CRCNIB
                DECMOD
                DECOD
                DIRC
                DIRH
                DIRL
                DIRNC
                DIRNOT
                DIRNZ
                DIRRND
                DIRZ
                DJF
                DJNF
                DJNZ
                DJZ
                DRVC
                DRVH
                DRVL
                DRVNC
                DRVNOT
                DRVNZ
                DRVRND
                DRVZ
                ENCOD
                EXECF
                FBLOCK
                FGE
                FGES
                FLE
                FLES
                FLTC
                FLTH
                FLTL
                FLTNC
                FLTNOT
                FLTNZ
                FLTRND
                FLTZ
                GETBRK
                GETBYTE
                GETBYTE
                GETCT
                GETNIB
                GETPTR
                GETQX
                GETQY
                GETRND
                GETRND
                GETSCP
                GETWORD
                GETWORD
                GETXACC
                HUBSET
                IJNZ
                IJZ
                INCMOD
                JATN
                JCT1
                JCT2
                JCT3
                JFBW
                JINT
                JMP
                JMPREL
                JNATN
                JNCT1
                JNCT2
                JNCT3
                JNFBW
                JNINT
                JNPAT
                JNQMT
                JNSE1
                JNSE2
                JNSE3
                JNSE4
                JNXFI
                JNXMT
                JNXRL
                JNXRO
                JPAT
                JQMT
                JSE1
                JSE2
                JSE3
                JSE4
                JXFI
                JXMT
                JXRL
                JXRO
                LOC
                LOCKNEW
                LOCKREL
                LOCKRET
                LOCKTRY
                MERGEB
                MERGEW
                MIXPIX
                MODC
                MODCZ
                MODZ
                MOV
                MOVBYTS
                MUL
                MULPIX
                MULS
                MUXC
                MUXNC
                MUXNIBS
                MUXNITS
                MUXNZ
                MUXQ
                MUXZ
                NEG
                NEGC
                NEGNC
                NEGNZ
                NEGZ
                NIXINT1
                NIXINT2
                NIXINT3
                NOP
                NOT
                ONES
                OR
                OUTC
                OUTH
                OUTL
                OUTNC
                OUTNOT
                OUTNZ
                OUTRND
                OUTZ
                POLLATN
                POLLCT1
                POLLCT2
                POLLCT3
                POLLFBW
                POLLINT
                POLLPAT
                POLLQMT
                POLLSE1
                POLLSE2
                POLLSE3
                POLLSE4
                POLLXFI
                POLLXMT
                POLLXRL
                POLLXRO
                POP
                POPA
                POPB
                PUSH
                PUSHA
                PUSHB
                QDIV
                QEXP
                QFRAC
                QLOG
                QMUL
                QROTATE
                QSQRT
                QVECTOR
                RCL
                RCR
                RCZL
                RCZR
                RDBYTE
                RDFAST
                RDLONG
                RDLUT
                RDPIN
                RDWORD
                REP
                RESI0
                RESI1
                RESI2
                RESI3
                RET
                RETA
                RETB
                RETI0
                RETI1
                RETI2
                RETI3
                REV
                RFBYTE
                RFLONG
                RFVAR
                RFVARS
                RFWORD
                RGBEXP
                RGBSQZ
                ROL
                ROLBYTE
                ROLBYTE
                ROLNIB
                ROLWORD
                ROLWORD
                ROR
                RQPIN
                SAL
                SAR
                SCA
                SCAS
                SETBYTE
                SETCFRQ
                SETCI
                SETCMOD
                SETCQ
                SETCY
                SETD
                SETDACS
                SETINT1
                SETINT2
                SETINT3
                SETLUTS
                SETNIB
                SETPAT
                SETPIV
                SETPIX
                SETQ
                SETQ2
                SETR
                SETS
                SETSCP
                SETSE1
                SETSE2
                SETSE3
                SETSE4
                SETWORD
                SETXFRQ
                SEUSSF
                SEUSSR
                SHL
                SHR
                SIGNX
                SKIP
                SKIPF
                SPLITB
                SPLITW
                STALLI
                SUB
                SUBR
                SUBS
                SUBSX
                SUBX
                SUMC
                SUMNC
                SUMNZ
                SUMZ
                TEST
                TESTB
                TESTBN
                TESTN
                TESTP
                TESTPN
                TJF
                TJNF
                TJNS
                TJNZ
                TJS
                TJV
                TJZ
                TRGINT1
                TRGINT2
                TRGINT3
                WAITATN
                WAITCT1
                WAITCT2
                WAITCT3
                WAITFBW
                WAITINT
                WAITPAT
                WAITSE1
                WAITSE2
                WAITSE3
                WAITSE4
                WAITX
                WAITXFI
                WAITXMT
                WAITXRL
                WAITXRO
                WFBYTE
                WFLONG
                WFWORD
                WMLONG
                WRBYTE
                WRC
                WRFAST
                WRLONG
                WRLUT
                WRNC
                WRNZ
                WRPIN
                WRWORD
                WRZ
                WXPIN
                WYPIN
                XCONT
                XINIT
                XOR
                XORO32
                XSTOP
                XZERO
                ZEROX
    ' flag write controls
    WC | WZ | WCZ
    XORC
    XORZ
    ORC
    ORZ
    ANDC
    ANDZ

    ' instruction conditionals
    _RET_
    IF_NC_AND_NZ
    IF_NZ_AND_NC
    IF_A
    IF_00
    IF_NC_AND_Z
    IF_Z_AND_NC
    IF_01
    IF_NC
    IF_AE
    IF_0X
    IF_C_AND_NZ
    IF_NZ_AND_C
    IF_10
    IF_NZ
    IF_NE
    IF_X0
    IF_C_NE_Z
    IF_Z_NE_C
    IF_DIFF
    IF_NC_OR_NZ
    IF_NZ_OR_NC
    IF_NOT_11
    IF_C_AND_Z
    IF_Z_AND_C
    IF_11
    IF_C_EQ_Z
    IF_Z_EQ_C
    IF_SAME
    IF_Z
    IF_E
    IF_X1
    IF_NC_OR_Z
    IF_Z_OR_NC
    IF_NOT_10
    IF_C
    IF_B
    IF_1X
    IF_C_OR_NZ
    IF_NZ_OR_C
    IF_NOT_01
    IF_C_OR_Z
    IF_Z_OR_C
    IF_BE
    IF_NOT_00
    IF_LE
    IF_LT
    IF_GE
    IF_GT

                FIT

DAT { instructions by group }

                ORG
                ORGH
                ORGF
                CALL            ' Branch
                CALL            ' Branch
                CALLA           ' Branch
                CALLB           ' Branch
                CALLD     ' Branch
                CALLPA    ' Branch
                CALLPB    ' Branch

                DJF       ' Branch
                DJNF      ' Branch
                DJNZ      ' Branch
                DJZ       ' Branch

                EXECF ' Branch
                IJNZ      ' Branch
                IJZ       ' Branch

                JMP     ' Branch
                JMPREL  ' Branch

                REP       ' Branch

                RESI0 ' Branch
                RESI1 ' Branch
                RESI2 ' Branch
                RESI3 ' Branch

                RET               ' Branch
                RETA              ' Branch
                RETB              ' Branch
                RETI0 ' Branch
                RETI1 ' Branch
                RETI2 ' Branch
                RETI3 ' Branch

                SKIP  ' Branch
                SKIPF ' Branch

                TJF       ' Branch
                TJNF      ' Branch
                TJNS      ' Branch
                TJNZ      ' Branch
                TJS       ' Branch
                TJV       ' Branch
                TJZ       ' Branch


                SETCFRQ ' Color Space Converter
                SETCI   ' Color Space Converter
                SETCMOD ' Color Space Converter
                SETCQ   ' Color Space Converter
                SETCY   ' Color Space Converter


                GETQX           ' CORDIC Solver
                GETQY           ' CORDIC Solver
                QDIV      ' CORDIC Solver
                QEXP    ' CORDIC Solver
                QFRAC     ' CORDIC Solver
                QLOG    ' CORDIC Solver
                QMUL      ' CORDIC Solver
                QROTATE   ' CORDIC Solver
                QSQRT     ' CORDIC Solver
                QVECTOR   ' CORDIC Solver


                ADDCT1    ' Events
                ADDCT2    ' Events
                ADDCT3    ' Events
                COGATN  ' Events
                JATN      ' Events
                JCT1      ' Events
                JCT2      ' Events
                JCT3      ' Events
                JFBW      ' Events
                JINT      ' Events
                JNATN     ' Events
                JNCT1     ' Events
                JNCT2     ' Events
                JNCT3     ' Events
                JNFBW     ' Events
                JNINT     ' Events
                JNPAT     ' Events
                JNQMT     ' Events
                JNSE1     ' Events
                JNSE2     ' Events
                JNSE3     ' Events
                JNSE4     ' Events
                JNXFI     ' Events
                JNXMT     ' Events
                JNXRL     ' Events
                JNXRO     ' Events
                JPAT      ' Events
                JQMT      ' Events
                JSE1      ' Events
                JSE2      ' Events
                JSE3      ' Events
                JSE4      ' Events
                JXFI      ' Events
                JXMT      ' Events
                JXRL      ' Events
                JXRO      ' Events
                POLLATN           ' Events
                POLLCT1           ' Events
                POLLCT2           ' Events
                POLLCT3           ' Events
                POLLFBW           ' Events
                POLLINT           ' Events
                POLLPAT           ' Events
                POLLQMT           ' Events
                POLLSE1           ' Events
                POLLSE2           ' Events
                POLLSE3           ' Events
                POLLSE4           ' Events
                POLLXFI           ' Events
                POLLXMT           ' Events
                POLLXRL           ' Events
                POLLXRO           ' Events
                SETPAT    ' Events
                SETSE1  ' Events
                SETSE2  ' Events
                SETSE3  ' Events
                SETSE4  ' Events
                WAITATN           ' Events
                WAITCT1           ' Events
                WAITCT2           ' Events
                WAITCT3           ' Events
                WAITFBW           ' Events
                WAITINT           ' Events
                WAITPAT           ' Events
                WAITSE1           ' Events
                WAITSE2           ' Events
                WAITSE3           ' Events
                WAITSE4           ' Events
                WAITXFI           ' Events
                WAITXMT           ' Events
                WAITXRL           ' Events
                WAITXRO           ' Events


                COGID               ' Hub Control
                COGINIT         ' Hub Control
                COGSTOP ' Hub Control
                HUBSET  ' Hub Control
                LOCKNEW               ' Hub Control
                LOCKREL             ' Hub Control
                LOCKRET ' Hub Control
                LOCKTRY             ' Hub Control


                FBLOCK    ' Hub FIFO
                GETPTR  ' Hub FIFO
                RDFAST    ' Hub FIFO
                RFBYTE          ' Hub FIFO
                RFLONG          ' Hub FIFO
                RFVAR           ' Hub FIFO
                RFVARS          ' Hub FIFO
                RFWORD          ' Hub FIFO
                WFBYTE  ' Hub FIFO
                WFLONG  ' Hub FIFO
                WFWORD  ' Hub FIFO
                WRFAST    ' Hub FIFO


                POPA            ' Hub RAM
                POPB            ' Hub RAM
                PUSHA   ' Hub RAM
                PUSHB   ' Hub RAM
                RDBYTE  ' Hub RAM
                RDLONG  ' Hub RAM
                RDWORD  ' Hub RAM
                WMLONG  ' Hub RAM
                WRBYTE    ' Hub RAM
                WRLONG    ' Hub RAM
                WRWORD    ' Hub RAM


                ALLOWI  ' Interrupts
                BRK     ' Interrupts
                COGBRK  ' Interrupts
                GETBRK            ' Interrupts
                NIXINT1 ' Interrupts
                NIXINT2 ' Interrupts
                NIXINT3 ' Interrupts
                SETINT1 ' Interrupts
                SETINT2 ' Interrupts
                SETINT3 ' Interrupts
                STALLI  ' Interrupts
                TRGINT1 ' Interrupts
                TRGINT2 ' Interrupts
                TRGINT3 ' Interrupts


                RDLUT   ' Lookup Table
                SETLUTS ' Lookup Table
                WRLUT     ' Lookup Table


                ABS         ' Math and Logic
                ADD         ' Math and Logic
                ADDS        ' Math and Logic
                ADDSX       ' Math and Logic
                ADDX        ' Math and Logic
                AND         ' Math and Logic
                ANDN        ' Math and Logic
                BITC              ' Math and Logic
                BITH              ' Math and Logic
                BITL              ' Math and Logic
                BITNC             ' Math and Logic
                BITNOT            ' Math and Logic
                BITNZ             ' Math and Logic
                BITRND            ' Math and Logic
                BITZ              ' Math and Logic
                BMASK   ' Math and Logic
                CMP         ' Math and Logic
                CMPM        ' Math and Logic
                CMPR        ' Math and Logic
                CMPS        ' Math and Logic
                CMPSUB      ' Math and Logic
                CMPSX       ' Math and Logic
                CMPX        ' Math and Logic
                CRCBIT    ' Math and Logic
                CRCNIB    ' Math and Logic
                DECMOD      ' Math and Logic
                DECOD   ' Math and Logic
                ENCOD       ' Math and Logic
                FGE         ' Math and Logic
                FGES        ' Math and Logic
                FLE         ' Math and Logic
                FLES        ' Math and Logic
                GETBYTE ' Math and Logic
                GETNIB  ' Math and Logic
                GETWORD ' Math and Logic
                INCMOD      ' Math and Logic
                LOC       ' Math and Logic
                MERGEB  ' Math and Logic
                MERGEW  ' Math and Logic
                MODC                  ' Math and Logic
                MODCZ       ' Math and Logic
                MODZ                    ' Math and Logic
                MOV         ' Math and Logic
                MOVBYTS   ' Math and Logic
                MUL                 ' Math and Logic
                MULS                ' Math and Logic
                MUXC        ' Math and Logic
                MUXNC       ' Math and Logic
                MUXNIBS   ' Math and Logic
                MUXNITS   ' Math and Logic
                MUXNZ       ' Math and Logic
                MUXQ      ' Math and Logic
                MUXZ        ' Math and Logic
                NEG         ' Math and Logic
                NEGC        ' Math and Logic
                NEGNC       ' Math and Logic
                NEGNZ       ' Math and Logic
                NEGZ        ' Math and Logic
                NOT         ' Math and Logic
                ONES        ' Math and Logic
                OR          ' Math and Logic
                RCL         ' Math and Logic
                RCR         ' Math and Logic
                RCZL            ' Math and Logic
                RCZR            ' Math and Logic
                REV     ' Math and Logic
                RGBEXP  ' Math and Logic
                RGBSQZ  ' Math and Logic
                ROL         ' Math and Logic
                ROLBYTE ' Math and Logic
                ROLNIB  ' Math and Logic
                ROLWORD ' Math and Logic
                ROR         ' Math and Logic
                SAL         ' Math and Logic
                SAR         ' Math and Logic
                SCA                 ' Math and Logic
                SCAS                ' Math and Logic
                SETBYTE   ' Math and Logic
                SETD      ' Math and Logic
                SETNIB    ' Math and Logic
                SETR      ' Math and Logic
                SETS      ' Math and Logic
                SETWORD   ' Math and Logic
                SEUSSF  ' Math and Logic
                SEUSSR  ' Math and Logic
                SHL         ' Math and Logic
                SHR         ' Math and Logic
                SIGNX       ' Math and Logic
                SPLITB  ' Math and Logic
                SPLITW  ' Math and Logic
                SUB         ' Math and Logic
                SUBR        ' Math and Logic
                SUBS        ' Math and Logic
                SUBSX       ' Math and Logic
                SUBX        ' Math and Logic
                SUMC        ' Math and Logic
                SUMNC       ' Math and Logic
                SUMNZ       ' Math and Logic
                SUMZ        ' Math and Logic
                TEST        ' Math and Logic
                TESTB         ' Math and Logic
                TESTBN        ' Math and Logic
                TESTN       ' Math and Logic
                WRC     ' Math and Logic
                WRNC    ' Math and Logic
                WRNZ    ' Math and Logic
                WRZ     ' Math and Logic
                XOR         ' Math and Logic
                XORO32  ' Math and Logic
                ZEROX       ' Math and Logic


                AUGD      ' Miscellaneous
                AUGS      ' Miscellaneous
                GETCT                 ' Miscellaneous
                GETRND   ' Miscellaneous
                NOP ' Miscellaneous
                POP             ' Miscellaneous
                PUSH    ' Miscellaneous
                SETQ    ' Miscellaneous
                SETQ2   ' Miscellaneous
                WAITX       ' Miscellaneous


                DIRC                ' Pins
                DIRH                ' Pins
                DIRL                ' Pins
                DIRNC               ' Pins
                DIRNOT              ' Pins
                DIRNZ               ' Pins
                DIRRND              ' Pins
                DIRZ                ' Pins

                DRVC                ' Pins
                DRVH                ' Pins
                DRVL                ' Pins
                DRVNC               ' Pins
                DRVNOT              ' Pins
                DRVNZ               ' Pins
                DRVRND              ' Pins
                DRVZ                ' Pins

                FLTC                ' Pins
                FLTH                ' Pins
                FLTL                ' Pins
                FLTNC               ' Pins
                FLTNOT              ' Pins
                FLTNZ               ' Pins
                FLTRND              ' Pins
                FLTZ                ' Pins

                OUTC                ' Pins
                OUTH                ' Pins
                OUTL                ' Pins
                OUTNC               ' Pins
                OUTNOT              ' Pins
                OUTNZ               ' Pins
                OUTRND              ' Pins
                OUTZ                ' Pins

                TESTP         ' Pins
                TESTPN        ' Pins

                ADDPIX    ' Pixel Mixer
                BLNPIX    ' Pixel Mixer
                MIXPIX    ' Pixel Mixer
                MULPIX    ' Pixel Mixer
                SETPIV  ' Pixel Mixer
                SETPIX  ' Pixel Mixer


                ALTB    ' Register Indirection -
                ALTD    ' Register Indirection -
                ALTGB   ' Register Indirection -
                ALTGN   ' Register Indirection -
                ALTGW   ' Register Indirection -
                ALTI    ' Register Indirection -
                ALTR    ' Register Indirection -
                ALTS    ' Register Indirection -
                ALTSB   ' Register Indirection -
                ALTSN   ' Register Indirection -
                ALTSW   ' Register Indirection -


                AKPIN     ' Smart Pins
                GETSCP  ' Smart Pins
                RDPIN             ' Smart Pins
                RQPIN             ' Smart Pins
                SETDACS ' Smart Pins
                SETSCP  ' Smart Pins
                WRPIN     ' Smart Pins
                WXPIN     ' Smart Pins
                WYPIN     ' Smart Pins


                GETXACC ' Streamer
                SETXFRQ ' Streamer
                XCONT     ' Streamer
                XINIT     ' Streamer
                XSTOP ' Streamer
                XZERO     ' Streamer

' symbols that are used in setting up smartpins
            P_ADC
            P_ADC_100X
            P_ADC_10X
            P_ADC_1X
            P_ADC_30X
            P_ADC_3X
            P_ADC_EXT
            P_ADC_FLOAT
            P_ADC_GIO
            P_ADC_SCOPE
            P_ADC_VIO
            P_ASYNC_IO
            P_ASYNC_RX
            P_ASYNC_TX
            P_BITDAC
            P_CHANNEL
            P_COMPARE_AB
            P_COMPARE_AB_FB
            P_COUNTER_HIGHS
            P_COUNTER_PERIODS
            P_COUNTER_TICKS
            P_COUNT_HIGHS
            P_COUNT_RISES
            P_DAC_124R_3V
            P_DAC_600R_2V
            P_DAC_75R_2V
            P_DAC_990R_3V
            P_DAC_DITHER_PWM
            P_DAC_DITHER_RND
            P_DAC_NOISE
            P_EVENTS_TICKS
            P_HIGH_100UA
            P_HIGH_10UA
            P_HIGH_150K
            P_HIGH_15K
            P_HIGH_1K5
            P_HIGH_1MA
            P_HIGH_FAST
            P_HIGH_FLOAT
            P_HIGH_TICKS
            P_INVERT_A
            P_INVERT_B
            P_INVERT_IN
            P_INVERT_OUTPUT
            P_LEVEL_A
            P_LEVEL_A_FBN
            P_LEVEL_A_FBP
            P_LOCAL_A
            P_LOCAL_B
            P_LOGIC_A
            P_LOGIC_A_FB
            P_LOGIC_B_FB
            P_LOW_100UA
            P_LOW_10UA
            P_LOW_150K
            P_LOW_15K
            P_LOW_1K5
            P_LOW_1MA
            P_LOW_FAST
            P_LOW_FLOAT
            P_MINUS1_A
            P_MINUS1_B
            P_MINUS2_A
            P_MINUS2_B
            P_MINUS3_A
            P_MINUS3_B
            P_NCO_DUTY
            P_NCO_FREQ
            P_NORMAL
            P_OE
            P_OUTBIT_A
            P_OUTBIT_B
            P_PERIODS_HIGHS
            P_PERIODS_TICKS
            P_PLUS1_A
            P_PLUS1_B
            P_PLUS2_A
            P_PLUS2_B
            P_PLUS3_A
            P_PLUS3_B
            P_PULSE
            P_PWM_SAWTOOTH
            P_PWM_SMPS
            P_PWM_TRIANGLE
            P_QUADRATURE
            P_REG_DOWN
            P_REG_UP
            P_REPOSITORY
            P_SCHMITT_A
            P_SCHMITT_A_FB
            P_SCHMITT_B_FB
            P_STATE_TICKS
            P_SYNC_IO
            P_SYNC_RX
            P_SYNC_TX
            P_TRANSITION
            P_TRUE_A
            P_TRUE_B
            P_TRUE_IN
            P_TRUE_OUTPUT
            P_TT_00
            P_TT_01
            P_TT_10
            P_TT_11
            P_USB_PAIR

' symbols that are used to setup streamers
        X_16P_2DAC8_WFWORD
        X_16P_4DAC4_WFWORD
        X_1ADC8_0P_1DAC8_WFBYTE
        X_1ADC8_8P_2DAC8_WFWORD
        X_1P_1DAC1_WFBYTE
        X_2ADC8_0P_2DAC8_WFWORD
        X_2ADC8_16P_4DAC8_WFLONG
        X_2P_1DAC2_WFBYTE
        X_2P_2DAC1_WFBYTE
        X_32P_4DAC8_WFLONG
        X_4ADC8_0P_4DAC8_WFLONG
        X_4P_1DAC4_WFBYTE
        X_4P_2DAC2_WFBYTE
        X_4P_4DAC1_WF_BYTE
        X_8P_1DAC8_WFBYTE
        X_8P_2DAC4_WFBYTE
        X_8P_4DAC2_WFBYTE
        X_ALT_OFF
        X_ALT_ON
        X_DACS_0N0_0N0
        X_DACS_0N0_X_X
        X_DACS_0_0_0_0
        X_DACS_0_0_X_X
        X_DACS_0_X_X_X
        X_DACS_1N1_0N0
        X_DACS_1_0_1_0
        X_DACS_1_0_X_X
        X_DACS_3_2_1_0
        X_DACS_OFF
        X_DACS_X_0_X_X
        X_DACS_X_X_0N0
        X_DACS_X_X_0_0
        X_DACS_X_X_0_X
        X_DACS_X_X_1_0
        X_DACS_X_X_X_0
        X_DDS_GOERTZEL_SINC1
        X_DDS_GOERTZEL_SINC2
        X_IMM_16X2_1DAC2
        X_IMM_16X2_2DAC1
        X_IMM_16X2_LUT
        X_IMM_1X32_4DAC8
        X_IMM_2X16_2DAC8
        X_IMM_2X16_4DAC4
        X_IMM_32X1_1DAC1
        X_IMM_32X1_LUT
        X_IMM_4X8_1DAC8
        X_IMM_4X8_2DAC4
        X_IMM_4X8_4DAC2
        X_IMM_4X8_LUT
        X_IMM_8X4_1DAC4
        X_IMM_8X4_2DAC2
        X_IMM_8X4_4DAC1
        X_IMM_8X4_LUT
        X_PINS_OFF
        X_PINS_ON
        X_RFBYTE_1P_1DAC1
        X_RFBYTE_2P_1DAC2
        X_RFBYTE_2P_2DAC1
        X_RFBYTE_4P_1DAC4
        X_RFBYTE_4P_2DAC2
        X_RFBYTE_4P_4DAC1
        X_RFBYTE_8P_1DAC8
        X_RFBYTE_8P_2DAC4
        X_RFBYTE_8P_4DAC2
        X_RFBYTE_LUMA8
        X_RFBYTE_RGB8
        X_RFBYTE_RGBI8
        X_RFLONG_16X2_LUT
        X_RFLONG_32P_4DAC8
        X_RFLONG_32X1_LUT
        X_RFLONG_4X8_LUT
        X_RFLONG_8X4_LUT
        X_RFLONG_RGB24
        X_RFWORD_16P_2DAC8
        X_RFWORD_16P_4DAC4
        X_RFWORD_RGB16
        X_WRITE_OFF
        X_WRITE_ON
    FIT


CON { license }

{{


 -------------------------------------------------------------------------------------------------
  MIT License

  Copyright (c) 2022 Iron Sheep Productions, LLC

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
 =================================================================================================
}}
